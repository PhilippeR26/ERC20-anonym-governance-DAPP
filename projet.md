# Objective
Demo DApp showing ERC20 governance with anonymous ZK voting (SNIP-36).
- Branch `main`: Starknet Sepolia, local proof server (`localhost:3030`)
- Branch `external-server`: Starknet Mainnet, local snip36 proof server by default (`PROVER=local`) or the Starknet Foundation prover gateway (`PROVER=gateway`); the Starkscan prover is STRK20-only, not usable here

# Stack
- Next.js 16, Chakra UI v3, Zustand v5
- `starknet@11.4.3` — client (`WalletAccountV6`, reads, nullifier check) and Server Actions (`getSignedTransaction`, `execute` with proof)
- `@starknet-io/get-starknet-wallet-standard 6.0.6`, `@starknet-io/get-starknet-discovery 6.0.6` — pinned to the version starknet.js 11.4.3 depends on

# Contracts
- GovToken (ERC20 + votes): `/D/Starknet/ERC20-anonym-governance-vote`
- AnonGovernor: same repo; uses OpenZeppelin fork `{ git = "https://github.com/PhilippeR26/OZ-contracts", branch = "anonym-vote-frontend" }`

# Contract Design
`create_proof()` takes `voter: ContractAddress` explicitly, verifies via `is_valid_signature()` (SRC-6), and checks voting power against `voter` instead of `get_caller_address()`. This allows the backend to sign the virtual tx while the voter's identity is verified via their SNIP-12 signature.

`cast_anonymous_vote(public_message)` has **no caller check** — any account can submit it. Anonymity is enforced by the SNIP-36 protocol-level proof, not by who submits the transaction.

# Vote Flow (client-orchestrated)
1. Wallet signs `AnonVoteIntent { proposalId, support }` via `wallet_signTypedData` (SNIP-12)
2. Server Action `generateProof(proposalId, support, voterAddress, signature)`:
   - Backend account calls `getSignedTransaction(create_proof(...))` → signed virtual tx
   - The proof server selected by `PROVER` runs the tx against the reference block (chain head): local server via `POST /prove` (Server-Sent Events), or gateway via JSON-RPC `starknet_proveTransaction`; returns `{ proof, proofFacts, l2ToL1Messages }`
   - `publicMessage` decoded from L2→L1 message payload
   - Backend account calls `execute(cast_anonymous_vote(publicMessage), { proof, proofFacts })`
   - Returns `{ transaction_hash }`
3. Client waits for confirmation via `provider.waitForTransaction(transaction_hash)`

# Backend Account
A keypair (address + private key) needed server-side. Must hold **STRK** for signing the virtual tx (tx is never broadcast; STRK not actually spent). Governance tokens are delegated TO the voter wallet — the backend account itself needs no tokens.

# Proof Server
Selected by `PROVER` in `.env.local`:
- `local` (default): local snip36 proof server `/D/Starknet/secure-voty/proofServer` (snip36 v1.3.0), `PROOF_SERVER_URL=http://localhost:3030`, started with its Mainnet `.env`. Works on Mainnet with Starknet 0.14.4 blocks and the chain head as reference block (2026-10-27).
- `gateway`: Starknet Foundation prover gateway (JSON-RPC 2.0, `x-api-key`), `PROOF_GATEWAY_URL` / `PROOF_GATEWAY_API_KEY`. On 2026-10-27 it rejected Starknet 0.14.4 blocks ("Invalid Starknet version: [0, 14, 4]").
- The Starkscan prover (https://starkscan.co/docs/api/strk20-prover) only proves STRK20 transactions (per Adrien, 2026-10-27): not usable here.

# Environment Variables
```env
# Public (NEXT_PUBLIC_ prefix → safe to expose to browser)
NEXT_PUBLIC_GOVERNOR_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_ADDRESS=0x...

# Server only (no NEXT_PUBLIC_ prefix)
RPC_URL=https://starknet-mainnet.g.alchemy.com/...
BACKEND_ACCOUNT_ADDRESS=0x...
BACKEND_ACCOUNT_PRIVATE_KEY=0x...
PROVER=local                      # "local" (default) or "gateway"
PROOF_SERVER_URL=http://localhost:3030
PROOF_GATEWAY_URL=https://<prover-gateway-host>   # only with PROVER=gateway
PROOF_GATEWAY_API_KEY=snip36_...                  # only with PROVER=gateway
```
The RPC key is kept server-only and proxied through `/api/rpc` (Next.js route).

# Key Implementation Notes

## starknet.js v11 patterns
- `Contract` constructor: single options object `{ abi, address, providerOrAccount }`
- `gov.state()` returns `CairoCustomEnum` → use `.activeVariant()` to get `"Pending"`, `"Active"`, etc.
- `WalletAccountV6.execute()` takes only `calls`. `executeWithProof()` exists (STRK20), but the vote is submitted by the backend account so that the voter is not the visible sender
- `Account.getSignedTransaction()` and `Account.execute(calls, { proof, proofFacts })` are in standard `starknet` — `UniversalDetails` declares `proof` / `proofFacts`, no cast needed

## SNIP-12 typed data (critical)
- `version` must be `CairoBytes31.fromText("1").toHexString()` = `"0x31"`, **NOT** the integer `"1"`. Using `"1"` produces a different hash → `is_valid_signature` fails → `Result::unwrap failed.` from proof server.
- `chainId` must be the hex value from `wallet_requestChainId` (e.g., `"0x534e5f4d41494e"` for Mainnet), **NOT** `"SN_MAIN"`.

## Governor ABI specifics
- `proposal_votes` does **not** exist in `GovernorCountingAnonymousComponent` — vote counts are internal storage, not exposed as view functions
- Available terminal-state helpers: `quorum_reached(proposalId)`, `vote_succeeded(proposalId)`
- `ProposalState` enum variants: `Pending, Active, Canceled, Defeated, Succeeded, Queued, Executed` (no `Expired`)

## Delegation prerequisite
Delegation must happen **before** the proposal snapshot block. `get_past_votes(voter, snapshot)` is what the governor checks; tokens delegated after the proposal is created have no effect on that proposal.

## Temporary test helper
`GET /api/test/delegate?target=0x<voter>` — delegates the backend account's tokens to the target address. File: `src/app/api/test/delegate/route.ts`. **Remove once testing is complete.**

# How It Looks

**Header:** title + connect/disconnect wallet button. Red banner if wrong network.

**Admin block** (indigo accent):
- `ProposeForm`: hidden once a proposal exists. Enter description → "Launch vote".
- `ProposalStatus`: state + blocks remaining + Reset button.
- `VoteResults`: appears at end of vote — quorum reached, succeeded/defeated.

**Voter block** (green accent):
- `DelegationPanel`: shows voting power; "Delegate to myself" if zero.
- `VotePanel`: For / Against / Abstain buttons (disabled when not Active). During vote: shows "Your vote: ✓ For" in matching color + step progress stepper + "Try again" on error.

# References
- Node.js usage example: `~/Documents/starknet/starknet.js-workshop-typescript/src/scripts/Starknet142/Starknet142-Sepolia/28.testGovernance2Proof.ts`
- get-starknet usage example: `/D/Starknet/starknet-ready-session`
- Full design spec: `docs/superpowers/specs/2026-05-11-anon-governance-dapp-design.md`

# Language
Code and UI in English.
