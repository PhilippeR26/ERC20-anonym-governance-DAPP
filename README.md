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

**Deploying on Vercel** — **[Not validated]** not tried yet. `NEXT_PUBLIC_*` values are inlined into the browser bundle at build time, so changing the network means changing the variable and redeploying, or keeping one Vercel project per network. The vote route declares `maxDuration = 300` seconds, **[Not validated]** the limit of the most restrictive Vercel plan (Hobby with Fluid compute); a proof takes 40–50 s plus any wait in the proof server's queue. The local-network proof server cannot be reached from Vercel: use the public address and an API key.

---

## Part 1 — Using the DApp

### Prerequisites

| Requirement | Details |
|---|---|
| Starknet wallet | Argent X or Braavos connected to the **network chosen by `NEXT_PUBLIC_NETWORK`** (the DApp shows which one) |
| Alchemy | An Alchemy API key (the RPC URL is derived from it and from the network) |
| Proof server | A SNIP-36 proof server with one instance per network, and an API key for its public address — see [Proof Servers](#proof-servers) |
| Backend account | An account address + private key on the chosen network, funded with STRK |
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

### Getting Voting Power

Voting power comes from the **GovToken** ERC20. You must **delegate** your tokens to yourself (or to another address) before the proposal is created — tokens delegated after the proposal snapshot block have no effect on that proposal.

**For testing**, use the built-in helper endpoint to delegate the backend account's tokens to your wallet:

```
http://localhost:3000/api/test/delegate?target=<YOUR_WALLET_ADDRESS>
```

> This endpoint exists for testing only and will be removed before any production deployment.

### Admin Workflow

The admin panel (indigo accent) is visible after connecting your wallet.

1. **Create a proposal** — enter a description and click "Launch vote". Once a proposal exists, the form is hidden.
2. **Monitor state** — the proposal state (`Pending → Active → Succeeded / Defeated → Executed`) is polled automatically with blocks remaining shown.
3. **View results** — once voting ends, quorum status and the outcome (succeeded / defeated) are displayed.
4. **Reset** — the Reset button clears the stored proposal so a new one can be submitted.

### Voter Workflow

The voter panel (green accent) is visible after connecting your wallet.

1. **Check voting power** — your current delegation is shown. If zero, click "Delegate to myself".
2. **Vote** — when the proposal is Active, choose For / Against / Abstain.
   - Your wallet signs an off-chain SNIP-12 typed message (no gas at this step).
   - A proof is generated by the proof server (about 40–50 seconds, plus the wait if other proofs are queued; the queue position is shown).
   - The backend account submits the anonymous vote on-chain.
3. **Confirmation** — "Your vote: ✓ For" is displayed in the matching color. A step progress stepper tracks each phase. If anything fails, a "Try again" button is available.

---

## Part 2 — How It Works

### System Architecture

```
Browser (Next.js DApp)
    │
    ├── Wallet (Argent/Braavos)         ← signs the SNIP-12 vote intent only
    │
    ├── /api/rpc                        ← RPC proxy (keeps RPC key server-side)
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

The DApp calls `/health` before every vote and when the page loads, and refuses to go on if the instance proves another network (a proof for the wrong network would be useless on-chain). `/prove` answers with a Server-Sent Events stream: `queued` (`{ position, etaSec }`, shown in the vote stepper), `started`, `log` (prover output, local listener only), `done` (`{ proof, proofFacts, l2ToL1Messages }`), `error` (`{ message }`). A refusal before the stream (quota used up, bad key, server busy…) is a JSON `{ reason, error }`, with a `Retry-After` header when known; the DApp shows it as is. If the announced queue wait exceeds the time left in the vote's budget, the vote stops at once with a clear message.

**Temporary, for local tests only** — `PROOF_SERVER_INSTANCE_URL` (commented out in `.env.local.example`) replaces `PROOF_SERVER_URL`: it is the full address of one instance, used as is, without sending any key, e.g. the local-network listener. Change its port together with `NEXT_PUBLIC_NETWORK`. It is meant to be removed before production.

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

### proposalStore Persistence

`proposalStore` (Zustand + `persist` middleware) stores `proposalId` and `description` in localStorage under the key `"anon-governance-proposal-v2-<network>"` (`sepolia` or `mainnet`, so a proposal of one network is never shown on the other). This survives page reloads. If the store shape changes, increment the key version to clear stale data.

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
