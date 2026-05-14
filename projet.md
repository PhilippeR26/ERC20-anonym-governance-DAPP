# Objective
Create a local demo DApp showing ERC20 governance with anonymous ZK voting (SNIP-36) on Starknet Sepolia.

# Stack
- Next.js 16, Chakra UI v3, Zustand v5
- `starknet@10.0.2` — client (wallet connection, reads, nullifier check)
- `starknetFork` (`github:PhilippeR26/starknet.js#buildExecute`) — Server Actions only (`getSignedTransaction`)
- `@starknet-io/get-starknet-wallet-standard v5`, `@starknet-io/get-starknet-discovery v5`

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
   - Proof server (`localhost:3030`) runs the tx, returns `{ proof, proofFacts, l2ToL1Messages }`
   - `publicMessage` decoded from L2→L1 message payload
   - Backend account calls `execute(cast_anonymous_vote(publicMessage), { proof, proofFacts })`
   - Returns `{ transaction_hash }`
3. Client waits for confirmation via `provider.waitForTransaction(transaction_hash)`

# Backend Account
A keypair (address + private key) needed server-side. Must hold **STRK** for signing the virtual tx (tx is never broadcast; STRK not actually spent). Governance tokens are delegated TO the voter wallet — the backend account itself needs no tokens.

# Proof Server
Local server at `http://localhost:3030`. Source: `/D/Starknet/secure-voty/proofServer`.

# Environment Variables
```env
# Public (NEXT_PUBLIC_ prefix → safe to expose to browser)
NEXT_PUBLIC_GOVERNOR_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_ADDRESS=0x...

# Server only (no NEXT_PUBLIC_ prefix)
RPC_URL=https://starknet-sepolia.g.alchemy.com/...   # proxied via /api/rpc
BACKEND_ACCOUNT_ADDRESS=0x...
BACKEND_ACCOUNT_PRIVATE_KEY=0x...
PROOF_SERVER_URL=http://localhost:3030
```
The RPC key is kept server-only and proxied through `/api/rpc` (Next.js route).

# Key Implementation Notes

## starknet.js v10 patterns
- `Contract` constructor: single options object `{ abi, address, providerOrAccount }`
- `gov.state()` returns `CairoCustomEnum` → use `.activeVariant()` to get `"Pending"`, `"Active"`, etc.
- `WalletAccountV5.execute()` takes only `calls` (no `UniversalDetails`, no proof) — standard wallet API cannot submit proof-enhanced transactions
- `Account.execute(calls, { proof, proofFacts } as UniversalDetails)` works in both `starknet@10.0.2` and `starknetFork`
- `starknetFork` adds only `Account.getSignedTransaction()` on top of `starknet@10.0.2`

## SNIP-12 typed data (critical)
- `version` must be `shortString.encodeShortString("1")` = `"0x31"`, **NOT** the integer `"1"`. Using `"1"` produces a different hash → `is_valid_signature` fails → `Result::unwrap failed.` from proof server.
- `chainId` must be the hex value from `wallet_requestChainId` (e.g., `"0x534e5f5345504f4c4941"`), **NOT** `"SN_SEPOLIA"`.

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
