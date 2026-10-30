# ERC20 Anonymous Governance DApp

A demo DApp that demonstrates **fully anonymous on-chain voting** via [SNIP-36 — In-Protocol Proof Verification](https://community.starknet.io/t/snip-36-in-protocol-proof-verification/116123) on Starknet, on Sepolia (testnet) or Mainnet, chosen by configuration.

Voters cast governance votes without revealing their identity or their choice on-chain. The contract only records a nullifier and a vote weight — never who voted nor which side they chose.

![DApp screenshot](pictures/screenShot.png)

> **Status:** Experimental / research. `GovernorCountingAnonymousComponent` is not audited.

---

## Choosing the network

A single branch, `main`, runs on **Starknet Sepolia** or **Starknet Mainnet**. The network is chosen by `NEXT_PUBLIC_NETWORK` (`sepolia` or `mainnet`) in `.env.local`:

| | `sepolia` | `mainnet` |
|---|---|---|
| Badge in the header | Sepolia testnet | Mainnet |
| Wallet must be on | Starknet Sepolia | Starknet Mainnet |
| RPC | Alchemy Sepolia (from `ALCHEMY_API_KEY`) | Alchemy Mainnet (from `ALCHEMY_API_KEY`) |
| Backend account | `SEPOLIA_BACKEND_ACCOUNT_*` | `MAINNET_BACKEND_ACCOUNT_*` |
| Proof-server instance | `<PROOF_SERVER_URL>/sepolia` | `<PROOF_SERVER_URL>/mainnet` |
| Block explorer | sepolia.starkscan.co | starkscan.co |

The deployed GovToken and AnonGovernor addresses of each network are built into `src/app/utils/network.ts` (they can be overridden, see `.env.local.example`).

`NEXT_PUBLIC_NETWORK` is read at build time: restart `npm run dev` after changing it.

**Deploying on Vercel** — **[Not validated]** not tried yet.

- **One Vercel project per network.** `NEXT_PUBLIC_*` values are inlined into the browser bundle at build time, so changing the network means changing the variable and redeploying; to serve both networks, create two projects from the same repository with different variables.
- **Variables**: those of `.env.local.example`. The red banner at the top of the page lists the ones that are missing. The DApp always uses the proof server's public address and its API key: the local-network listener of the proof server is not used.
- **Duration.** The vote route declares `maxDuration = 300` seconds. According to the Vercel documentation (read on 2026-10-30, page updated 2026-08-24), with Fluid compute (enabled by default) 300 s is the maximum of the Hobby plan (800 s on Pro). A proof takes 40–50 s plus any wait in the proof server's queue. The documentation does not say what the browser receives when a streamed response is stopped at the limit, and the vote stream sends nothing while the proof is computed: **[Not validated]** whether an intermediary cuts such a silence.
- **The four public routes use the server's keys, or the sponsor's funds, for whoever calls them.**
  - `/api/vote` does free on-chain reads first (the proposal is Active, and `create_proof` runs as a read: voter signature, voting power at the snapshot, nullifier unused), so a request the contract would refuse never reaches the proof server or its daily quota. A valid request sent again while its vote is not yet recorded can still cost extra proofs; the proof server caps this (2 simultaneous requests and a daily quota per site).
  - `/api/rpc` relays only the six methods the DApp uses, and `starknet_call` only on the governor and the token; anything else gets a JSON-RPC error and a warning in the server log.
  - `/api/faucet` and `/api/propose` send transactions from the backend account (the sponsor) for whoever calls them. A request the contract would refuse (bad signature, account not deployed, empty description…) is stopped before anything is sent and costs no STRK, but a valid one is paid by the sponsor, and there is no rate limit: the sponsor's balance is the cap. Keep on the backend account only what the demo can afford to lose. Both routes declare no `maxDuration`, and `/api/propose` may wait for the sponsor's one-time self-delegation to be accepted (a few seconds to some tens of seconds): **[Not validated]** that the platform's default duration is enough on your Vercel plan.
  - None of these routes limits the number of requests: each refused request still costs a few Alchemy reads, within Alchemy's own limits.

---

## Part 1 — Using the DApp

### Prerequisites

| Requirement | Details |
|---|---|
| Starknet wallet | Argent X or Braavos connected to the **network chosen by `NEXT_PUBLIC_NETWORK`** (the DApp shows which one) |
| Alchemy | An Alchemy API key (the RPC URL is derived from it and from the network) |
| Proof server | A SNIP-36 proof server with one instance per network, and an API key for its public address — see [Proof Servers](#proof-servers) |
| Backend account | An account address + private key on the chosen network, funded with STRK. It is the **sponsor** of the demo: it must own the GovToken (the grants mint tokens) and it pays for every transaction |
| Node.js | v22.12+ (required by starknet.js v11) |

> A proof takes about 40–50 seconds; the duration is logged in the Next.js server console.

### Setup

1. **Clone and install**

   ```bash
   git clone https://github.com/PhilippeR26/ERC20-anonym-governance-DAPP
   cd ERC20-anonym-governance-DAPP
   npm install
   ```

2. **Configure environment variables** — copy `.env.local.example` to `.env.local` and fill in:

   ```env
   # Public — exposed to the browser
   NEXT_PUBLIC_NETWORK=sepolia            # or mainnet

   # Server only — never exposed to the browser
   ALCHEMY_API_KEY=<key>
   SEPOLIA_BACKEND_ACCOUNT_ADDRESS=0x...  # only the account of the active network is read
   SEPOLIA_BACKEND_ACCOUNT_PRIVATE_KEY=0x...
   MAINNET_BACKEND_ACCOUNT_ADDRESS=0x...
   MAINNET_BACKEND_ACCOUNT_PRIVATE_KEY=0x...
   PROOF_SERVER_URL=https://<name>.duckdns.org   # the DApp appends /sepolia or /mainnet
   PROOF_SERVER_API_KEY=<site key>
   ```

   `PROOF_SERVER_API_KEY` is sent as `Authorization: Bearer <key>` and must be kept server-side only. If a variable is missing, or the proof-server instance proves the other network, a red banner at the top of the page says so.

3. **Start the DApp**:

   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

### Network Guard

The DApp only works on the network it runs on, always shown by the badge next to the title, and the connect dialog says which network to use. If your wallet is on a different network, a red banner names both networks and the admin and voter panels are hidden. Switch the network **manually in your wallet** (the DApp never asks the wallet to switch: some wallets refuse), then reconnect: the wallet's network is read once, when connecting.

### The demo journey

A visitor with an already-deployed wallet goes through the whole demo while the wallet only connects and signs two off-chain messages. Every transaction is sent and paid by the backend account, called the **sponsor**:

| Step | The wallet | The sponsor sends |
|---|---|---|
| 1. Get voting power | signs a SNIP-12 `Delegation` message | `mint` of 100,000 tokens and `delegate_by_sig`, in one transaction (`POST /api/faucet`) |
| 2. Create a vote | nothing | `propose` (`POST /api/propose`) |
| 3. Vote | signs the SNIP-12 vote intent | `cast_anonymous_vote` with the proof (`POST /api/vote`) |
| 4. Check the anonymity | nothing | nothing: three explorer links and a short explanation |

The page reads in that order: **Voting power**, **Administrator** (create, state), **Voter** (vote, result, anonymity check).

- **Deployed account required.** `delegate_by_sig` verifies the signature through the visitor's account contract (SRC-6), so the account must exist on-chain. A new, undeployed wallet is refused with "This account is not deployed yet: deploy it from your wallet (any transaction does it), then come back."
- **One grant per address.** An address that already holds GovToken is refused ("This address already has its voting power").
- **Anyone can create a vote.** The governor only asks the proposer for `proposal_threshold` votes, and the proposer is the sponsor.
- **Cost.** A visitor costs the sponsor three transactions (grant, proposal, vote), paid in STRK: real money on Mainnet. There is no rate limit; the sponsor's balance and the proof server's daily quota are the caps.
- **Short voting window.** On the demo deployment a proposal becomes Active one block after its creation and stays open for 50 blocks (roughly 80 seconds), while a proof takes 40–50 seconds: vote as soon as the proposal is Active.
- **Anonymity set.** The vote hides *which* eligible voter cast it, not that a vote happened. A visitor usually creates their own proposal and is its only voter, so the timing alone links the grant to the vote: the demo shows what the transactions reveal (the vote transaction carries no voter address), not the privacy of a crowd.

### Getting Voting Power

Voting power comes from the **GovToken** ERC20, and a token only carries votes once it is **delegated**. A proposal counts the votes held before its snapshot block, so the voting power must exist before the proposal is created (the "Launch vote" button waits for it).

The **Voting power** panel at the top of the page does it in one click. "Get voting power" asks your wallet for one off-chain signature (a SNIP-12 `Delegation` message, no gas) and calls `POST /api/faucet`: the sponsor mints 100,000 GovToken to your address and activates their votes for you. The signature is what allows it: a delegation needs the holder's consent, and here you delegate to yourself, so nobody votes in your place. The page words it as "activate your votes", because "delegate" sounds like handing your vote to someone else, and asks for a single check: `delegatee` must be your own address (the other fields are in a collapsible detail). The panel then shows your voting power in whole tokens. 100,000 is the quorum of the demo governor, so one visitor voting "For" is enough for the proposal to pass. An address that already has voting power sees it straight away.

### Admin Workflow

The admin panel (indigo accent) is visible after connecting your wallet.

1. **Create a proposal** — enter a description (200 characters at most) and click "Launch vote". The button waits for your voting power. The sponsor sends the proposal, so your wallet signs nothing, and a UTC time mark such as `[demo 2026-10-30 18:00:00 UTC]` is appended to the description: a proposal id is the hash of its description, so two visitors typing the same text would otherwise get the same proposal. While a proposal is running, the form is hidden.
2. **Monitor state** — the proposal state (`Pending → Active → Succeeded / Defeated → Executed`) is polled automatically with blocks remaining shown.
3. **New vote** — once a proposal has ended, the form is shown again and the next vote replaces it (the last proposal stays on the page, with its result and anonymity check, until then; a new connection or a reload starts from a clean page). The "New vote" button forgets it earlier, without creating another.

The results are shown in the voter panel, under the vote.

### Voter Workflow

The voter panel (green accent) is visible after connecting your wallet.

1. **Vote** — when the proposal is Active, choose For / Against / Abstain (your voting power comes from the panel at the top of the page).
   - Your wallet signs an off-chain SNIP-12 typed message (no gas at this step): an `AnonVoteIntent` with two values, `proposal_id` and `support` (0 = Against, 1 = For, 2 = Abstain). Wallets label these fields their own way (Ready X shows "Proposal id" and "Support"), so the page lists, above the vote buttons, what to check: your choice and the proposal id (the domain, name and chain id, is in a collapsible detail), and it repeats the expected `support` while you sign.
   - A proof is generated by the proof server (about 40–50 seconds, plus the wait if other proofs are queued; the queue position is shown).
   - The backend account submits the anonymous vote on-chain.
2. **Confirmation** — "Your vote: ✓ For" is displayed in the matching color. A step progress stepper tracks each phase. If anything fails, a "Try again" button is available; the "Get voting power" and "Launch vote" steps show their errors with the same button, because a wallet sometimes answers too late and a retry is what fixes it.
3. **Result** — once voting ends, the quorum status and the outcome (succeeded / defeated) are displayed under the vote.
4. **Anonymity check** — once the vote is recorded, a box links the three transactions of your journey on the block explorer: the grant, the proposal and the vote. Open them and compare: only the grant names your address, while the vote is sent by the sponsor and its event holds only the proposal, a nullifier, the choice and the weight. The box belongs to this journey: "New vote", a new connection or a reload clears it.

---

## Part 2 — How It Works

### System Architecture

```
Browser (Next.js DApp)
    │
    ├── Wallet (Argent/Braavos)         ← connects and signs SNIP-12 messages only
    │
    ├── /api/rpc                        ← RPC proxy (keeps RPC key server-side)
    │
    ├── POST /api/faucet                ← sponsor sends mint + delegate_by_sig
    ├── POST /api/propose               ← sponsor sends propose
    │
    └── POST /api/vote (streams progress events)
            │
            ├── backend Account         ← builds signed virtual INVOKE_TXN_V3
            │
            └── SNIP-36 proof server (instance of the active network)
                    │
                    ├── Runs create_proof() in SNIP-36 virtual OS
                    └── Returns { proof, proofFacts, l2ToL1Messages }

On-chain (Starknet Sepolia or Mainnet)
    ├── GovToken (ERC20 + checkpoints)
    └── AnonGovernor
            ├── cast_anonymous_vote()   ← submitted by backend account
            └── verify proof facts via SNIP-36
```

A single starknet.js package, `starknet@11.4.3`, is used on both sides:

| Side | Role |
|---|---|
| Client | `WalletAccountV6` (get-starknet v6), reads, nullifier check |
| Vote route (`/api/vote`) | Backend `Account`: `getSignedTransaction()` for the virtual tx, `execute()` with proof for the vote |
| Grant and proposal routes (`/api/faucet`, `/api/propose`) | The sponsor, a backend `Account`: `execute()` of `mint` + `delegate_by_sig`, and of `propose` |

The get-starknet packages are pinned to `6.0.6`, the exact version starknet.js 11.4.3 depends on, so that the wallet object passed to `WalletAccountV6.connect()` is typed from a single copy of `@starknet-io/get-starknet-wallet-standard`.

### Contracts

The governance system is deployed from [ERC20-anonym-governance-vote](https://github.com/PhilippeR26/ERC20-anonym-governance-vote).

**GovToken** — an ERC20 governance token with voting power checkpoints (`VotesComponent`). Every transfer updates checkpoints via `after_update`. Holders must delegate (to themselves or another address) before their power is counted in a proposal.

**AnonGovernor** — manages the full proposal lifecycle and replaces standard vote counting with `GovernorCountingAnonymousComponent`. Key points:

- `cast_vote*` functions are disabled — they always panic with `'Use cast_anonymous_vote'`.
- `cast_anonymous_vote(public_message)` has **no caller check** — any account can submit it. Anonymity is enforced by the SNIP-36 proof, not by restricting the submitter.
- `create_proof()` takes `voter: ContractAddress` explicitly and verifies the voter's identity via `account.is_valid_signature()` (SRC-6) against the SNIP-12 hash. This allows the backend account to sign the virtual transaction while the voter's identity is verified through their own signature.
- `proposal_votes()` does **not** exist. Vote counts are internal storage. Only `quorum_reached(proposalId)` and `vote_succeeded(proposalId)` are publicly readable.

The AnonGovernor depends on a private fork of OpenZeppelin Cairo contracts:

```toml
openzeppelin = { git = "https://github.com/PhilippeR26/OZ-contracts", branch = "anon-vote-frontend" }
```

### The Three-Step Anonymous Vote Flow

#### Step 1 — Off-chain: sign the vote intent (wallet)

The voter signs a **SNIP-12 typed message** (`AnonVoteIntent`) with their wallet. This message encodes the `proposal_id` and their `support` choice (0 = Against, 1 = For, 2 = Abstain), plus SNIP-12 domain fields (`name`, `version`, `chain_id`, `contract_address`).

The resulting ECDSA signature `(r, s)` never leaves the browser in plain form. It serves two purposes downstream:

- **Identity proof** — the voter's public key can be recovered from `(r, s)` and the message hash. The proof server checks it matches the public key stored in the voter's account contract.
- **Nullifier seed** — `(r, s)` are hashed with `proposal_id` via Poseidon to produce a unique one-time nullifier that prevents double-voting.

This is the only step that requires the voter's wallet. No gas is spent.

> **Important SNIP-12 encoding detail:** The domain `version` field must be `CairoBytes31.fromText("1").toHexString()` = `"0x31"`, not the integer `"1"`. Using `"1"` produces a different hash, causing `is_valid_signature` to fail with `Result::unwrap failed.` from the proof server. Similarly, `chain_id` must be the hex value returned by `wallet_requestChainId` (e.g. `"0x534e5f4d41494e"` for Mainnet), not the string `"SN_MAIN"`.

#### Step 2 — Off-chain: generate the proof (vote route + proof server)

The browser calls the streaming route `POST /api/vote` with `{ proposalId, support, voterAddress, signature }`. Before anything else, the route checks that the proof-server instance proves the DApp's network (`GET /health`). It then orchestrates the proof, and streams the proof server's queue position back to the page while the proof runs:

1. With `Account.getSignedTransaction()`, the backend account builds a signed `INVOKE_TXN_V3` calling `create_proof(proposal_id, support, voter, AnonVotePrivateInput { signature: [r, s] })`. This is a **virtual transaction** — it is never broadcast to the network. The prover requires a **max possible fee of zero**, so all `max_price_per_unit` fields and `tip` are set to `0`. However, gas **amounts** (`max_amount`) must be non-zero — setting them to zero causes `__validate__` to panic with `'Out of gas'` before `create_proof` runs.

   > [!WARNING]
   > **Never use `estimateFee()` for this virtual transaction.** The calldata contains the voter's identity (`voter` address) and their vote choice (encoded in the SNIP-12 signature `(r, s)`). Calling `estimateFee()` would send this calldata to an RPC node for simulation, exposing both who votes and what they vote to that node — breaking anonymity before the proof is even generated. Resource bounds are therefore hardcoded to safe upper bounds.

2. The proof server (see [Proof Servers](#proof-servers) below) receives the signed transaction, runs `create_proof` in the SNIP-36 virtual OS and:
   - Recovers the voter's public key from `(r, s)` and verifies it against the on-chain account.
   - Reads the voter's **past voting weight** from the token checkpoint at the proposal snapshot block (read from on-chain state, not supplied by the voter — this cannot be forged).
   - Computes the nullifier: `poseidon(NULLIFIER_DOMAIN, proposal_id, poseidon(r, s))`.
   - Builds `AnonVoteMessage { proposal_id, nullifier, support, weight }` and hashes it as an **L2→L1 message**. This tamper-proof commitment is verified on-chain: the contract recomputes the hash from the submitted message and checks it against the proof facts.
   - Returns `{ proof, proofFacts, l2ToL1Messages }`.

3. The route decodes the `publicMessage` from `l2ToL1Messages` and calls `backend.execute(cast_anonymous_vote(publicMessage), { proof, proofFacts })`.

The voter's identity and their choice never appear in plain text on-chain.

#### Step 3 — On-chain: cast the vote (backend account)

`cast_anonymous_vote(public_message)` is submitted by the **backend account** with the SNIP-36 proof attached. The contract:

1. Reads proof facts from `get_execution_info_v3_syscall` (the SNIP-36 mechanism).
2. Recomputes the message hash from `AnonVoteMessage` and checks it against the proof facts.
3. Checks the nullifier has not been used (`is_nullifier_used`).
4. Marks the nullifier as consumed and tallies `{ nullifier, weight, support }`.

### Sponsored Grant and Proposal

Two more routes bring a visitor to the vote without a single wallet transaction. Both send from the **sponsor** (the backend account, built by `getSponsor()` in `src/app/server/sponsor.ts`) and report errors as data (`{ error }`, HTTP 400), like `/api/vote`.

**Grant — `POST /api/faucet`** (`src/app/server/grantVotingPower.ts`). The browser sends `{ address, nonce, expiry, signature }`. The signature is the visitor's SNIP-12 `Delegation` message (`verifying_contract`, `delegatee`, `nonce`, `expiry`) in the token's domain (`GovToken`, version `0x31`, revision 1). The route checks that the account is deployed and holds no token, then sends one transaction with two calls: `mint(address, 100_000e18)` (the sponsor owns the token) and `delegate_by_sig(address, address, nonce, expiry, signature)`. `delegate_by_sig` has no caller restriction: it checks the signature through the delegator's account (`is_valid_signature`) and the `expiry` (one hour here) against the block time, so the sponsor can submit it for the visitor.

**Proposal — `POST /api/propose`** (`src/app/server/createProposal.ts`). The browser sends `{ description }`; the route trims it (1 to 200 characters), appends a UTC time mark, and sends `propose` from the sponsor. It answers `{ proposalId, description, transactionHash }`, where `proposalId` is `hashProposal(description)`. The governor reads the proposer's votes one block before the proposal, so the sponsor must itself hold at least `proposal_threshold` votes: the route reads `get_votes(sponsor)` and, if they are lower, sends `delegate(sponsor)` and waits for it to be accepted before proposing. On the demo deployment on Sepolia this happens once, on the first proposal: the sponsor's tokens were delegated to a test wallet, which loses those votes. On Mainnet the sponsor is already self-delegated.

**Refusals.** When the contract refuses a call, the node reports the panic reason inside an RPC error: code 40 for a call, 41 for a failed fee estimation (which is where a refused transaction stops, before anything is sent). `contractReason()` (`src/app/server/contractReason.ts`) takes the last `('…')` of that error, so the visitor reads "Grant refused: …" or "Proposal refused: …" instead of a node dump.

### Proof Servers

`src/app/server/requestProof.ts` sends the signed virtual transaction to a SNIP-36 proof server: [secure-voty/proofServer](https://github.com/PhilippeR26/secure-voty) (branch `proof-server-v2`), a server around the `snip36` CLI of [snip-36-prover-backend](https://github.com/starknet-innovation/snip-36-prover-backend). It runs **one instance per network**, each with two listeners:

| Listener | Address | Access |
|---|---|---|
| Public, HTTPS (behind Caddy) | `<PROOF_SERVER_URL>/sepolia`, `<PROOF_SERVER_URL>/mainnet` | `Authorization: Bearer <PROOF_SERVER_API_KEY>`; daily quota per site and per network |
| Local network | `http://<machine>:<port>`, one port per network | no key, no quota |

The DApp uses the public listener: `PROOF_SERVER_URL` is the base address and the DApp appends the instance path of the active network. The site that owns the API key needs a quota on each network you use; it is created on the proof server (`./proof-server.sh site add ...`).

The reference block is the chain head (`REFERENCE_BLOCK_LAG = 0` in `src/app/utils/constants.ts`; raise it if a prover rejects blocks too close to the head).

```
GET  <instance>/health    → { "ok": true, "network": "sepolia", ... }

POST <instance>/prove
Authorization: Bearer <key>          (public listener only)

{ "blockNumber": <reference block>, "tx": <INVOKE_TXN_V3: tip=0, all max_price_per_unit=0, non-zero max_amount> }
```

The DApp calls `/health` before every vote and when the page loads, and refuses to go on if the instance proves another network (a proof for the wrong network would be useless on-chain). `/prove` answers with a Server-Sent Events stream: `queued` (`{ position, etaSec }`, shown in the vote stepper), `started`, `log` (prover output, local listener only), `done` (`{ proof, proofFacts, l2ToL1Messages }`), `error` (`{ message }`). A refusal before the stream (quota used up, bad key, server busy…) is a JSON `{ reason, error }`, with a `Retry-After` header when known; the DApp shows it as is. The announced wait only counts the proofs ahead of the vote, not its own proof (about 40–50 s): if the wait plus 60 s exceeds the time left in the vote's budget, the vote stops at once with a clear message.

`PROOF_SERVER_API_KEY` is required: a request without a key would only be refused. The proof server's address is never shown to visitors (banner, vote errors); it is written to the server log only.

> The Starknet Foundation prover gateway no longer works for this DApp, and the [Starkscan prover](https://starkscan.co/docs/api/strk20-prover) only proves STRK20 transactions: neither is used.

### Proposal Lifecycle

```
propose → [voting_delay blocks] → Active → [voting_period blocks] → Succeeded / Defeated
                                                                          ↓
                                                                       execute
```

| State | Description |
|---|---|
| `Pending` | Waiting for `voting_delay` to elapse |
| `Active` | Voting window open |
| `Succeeded` | Quorum reached and For > Against |
| `Defeated` | Quorum not reached, or Against ≥ For |
| `Executed` | On-chain calls dispatched |
| `Canceled` | Canceled by proposer or owner |

> `gov.state(proposalId)` returns a `CairoCustomEnum` in starknet.js v10. Use `.activeVariant()` to get the variant name string.

### Nullifier and Replay Protection

Each vote produces a nullifier bound to `(proposal_id, r, s)`. The DApp computes the nullifier in TypeScript (replicating `_compute_nullifier` with Poseidon) and calls `is_nullifier_used()` **before** requesting a proof — aborting early if the voter has already voted. The contract also rejects any transaction with a known nullifier.

`has_voted(proposalId, voterAddress)` always returns `false` — it is meaningless in an anonymous scheme.

### Why Standard Wallets Cannot Submit the Vote

Current Starknet wallets (Argent, Braavos) are limited to Step 1:

- **Step 2** requires building a raw `INVOKE_TXN_V3` signed transaction object via `Account.getSignedTransaction()` (standard starknet.js since v10.3.0). It signs with the account's private key; no wallet exposes this capability.
- **Step 3** requires attaching `{ proof, proofFacts }` to a transaction. `WalletAccountV6.execute()` only accepts a call array. Its `executeWithProof()` (get-starknet v6 wallet API, designed for STRK20) can attach a SNIP-36 proof, but submitting `cast_anonymous_vote` from the voter's own account would make the voter the visible sender of the vote transaction.

For both steps, the **backend account** — a standard `Account` from `starknet@11.4.3` with its own key pair and STRK balance — acts as the submitter. The voter's wallet is only used for the SNIP-12 signature in Step 1.

> The backend account needs STRK to submit `cast_anonymous_vote` on-chain (Step 3). The virtual transaction in Step 2 is never broadcast and has zero gas prices, so no STRK is spent there.

### Client-Side Nullifier Pre-check

Before calling `/api/vote`, the DApp:

1. Computes the nullifier in TypeScript using Poseidon (replicating the Cairo `_compute_nullifier` function).
2. Calls `is_nullifier_used(proposalId, nullifier)` on the governor contract.
3. If already used, aborts with an error message — skipping the proof generation (about 40–50 seconds).

### Demo State in the Browser

The demo journey lives in memory for one wallet connection: connecting a wallet, the same one or another, starts from a clean page, and so does a reload. `proposalStore` (Zustand, not persisted) holds the current proposal (`proposalId`, `description`), what was read from the chain about it, and the hashes of the proposal and vote transactions (`proposalTxHash`, `voteTxHash`, which feed the anonymity check); a new proposal clears everything of the previous one. The panels also start afresh for each proposal (vote panel, proposal form, proposal status) and for each account (voting-power panel): they are remounted with a React `key`. An answer that arrives after its journey ended (a vote confirmed after its proposal was replaced, a proposal or a voting power confirmed after a disconnection) is dropped.

Only `grantStore` is kept in localStorage, under `"anon-governance-grants-v1-<network>"`: the hash of the grant transaction of each address, a permanent on-chain fact that the anonymity check links to. If its shape changes in a way old data cannot satisfy, increment the key version to clear stale data.

---

## Lessons Learned

### Proof generation requires a dedicated backend

Generating a SNIP-36 proof requires a native Rust prover: about **2 GB of RAM** at peak with the low-memory prover, ~10 GB of disk for its dependencies, and **40–50 seconds** per proof on a 4-core laptop. It cannot run in a browser, so it needs a backend. In this DApp the proof is delegated over HTTP to a separate proof server (see [Proof Servers](#proof-servers)).

### Starknet wallets are not SNIP-36 friendly

Current Starknet wallets (Argent, Braavos, …) are not designed for SNIP-36 and block the flow at two points:

- They cannot produce a raw `INVOKE_TXN_V3` signed transaction object (needed to call `create_proof` on the proof server). Obtaining this format requires `Account.getSignedTransaction()` from standard starknet.js (since v10.3.0), run by the backend account.
- They cannot attach proof facts and a STARK proof to a transaction, so they cannot submit `cast_anonymous_vote` either.

Until wallets expose SNIP-36 primitives natively, anonymous voting requires a custom off-wallet execution path for everything after the initial SNIP-12 signature.

---

## Related Projects

| Project | Description |
|---|---|
| [ERC20-anonym-governance-vote](https://github.com/PhilippeR26/ERC20-anonym-governance-vote) | Cairo contracts: GovToken + AnonGovernor |
| [starknet.js-workshop-typescript — Starknet142-Sepolia](https://github.com/PhilippeR26/starknet.js-workshop-typescript/tree/main/src/scripts/Starknet142/Starknet142-Sepolia) | TypeScript usage examples (scripts 26–28) |
| [OZ-contracts fork](https://github.com/PhilippeR26/OZ-contracts) (`anon-vote-frontend` branch) | OpenZeppelin fork with `GovernorCountingAnonymousComponent` |

## License

MIT
