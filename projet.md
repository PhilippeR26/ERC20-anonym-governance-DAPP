# Objective
Create a local demo DApp showing ERC20 governance with anonymous ZK voting (SNIP-36) on Starknet Sepolia.

# Stack
- Next.js 16, Chakra UI v3, Zustand v5
- `starknet@10.0.2` — client (wallet connection, execute with proof)
- `starknetFork` (`github:PhilippeR26/starknet.js#buildExecute`) — Server Actions only (getSignedTransaction)
- `@starknet-io/get-starknet-wallet-standard v5`, `@starknet-io/get-starknet-discovery v5`

# Contracts
- GovToken (ERC20 + votes): `/D/Starknet/ERC20-anonym-governance-vote`
- AnonGovernor: same repo; uses OpenZeppelin fork `{ git = "https://github.com/PhilippeR26/OZ-contracts", branch = "anonym-vote-frontend" }`

# Prerequisite — Contract Modification Required
`create_proof()` currently uses `get_caller_address()` to check voting power. Browser wallets cannot produce a signed INVOKE transaction without broadcasting it, so the backend must sign the virtual tx — making `get_caller_address()` return the backend address, not the voter.

**Required change:** add `voter: ContractAddress` parameter to `create_proof()`, verify voter ownership via `is_valid_signature()` (SRC-6), and check voting power against `voter` instead of the caller. See the design spec for full details.

# Backend Account
A keypair (address + private key) is needed server-side to sign the virtual `create_proof()` INVOKE transaction sent to the proof server. This account needs **no governance tokens**, but **does need STRK** — enough to fund the virtual transaction for signing (the tx is never broadcast; no STRK is actually spent). The voter's wallet provides voting power and pays gas.

# Proof Server
Local server at `http://localhost:3030`. Receives `{ blockNumber, tx: INVOKE_TXN_V3 }` via POST `/prove`, streams result via SSE. Source: `/D/Starknet/secure-voty/proofServer`. Not in scope of this DApp — only its usage.

# How It Works

**Header:** title + connect/disconnect wallet button.

**Once connected**, two blocks are visible (same user is both admin and voter):

**Admin block** (top, indigo accent):
- Enter proposal description → "Launch vote" button
- Proposal state updated every 30s: countdown in blocks while active, then result (quorum reached, succeeded/defeated) with vote counts
- Always-visible banner: "A local proof server must be running on http://localhost:3030"

**Voter block** (bottom, green accent):
- If voting power = 0: delegation panel — "Delegate your tokens to activate voting" + [Delegate to myself] button
- If voting power > 0 and proposal active: For / Against / Abstain buttons
- Buttons disabled (with explanation) when: no active proposal, no voting power, already voted
- On vote click: stepped progress — Signing → Generating ZK proof (~50s) → Submitting → Done

**Vote signing:** `wallet_signTypedData(AnonVoteIntent { proposalId, support })` — a SNIP-12 typed data message specific to the proposal and choice. The signature is used as the private input to the ZK proof and to compute the nullifier (double-vote prevention).

# References
- Node.js usage example: `~/Documents/starknet/starknet.js-workshop-typescript/src/scripts/Starknet142/Starknet142-Sepolia/28.testGovernance2Proof.ts` (also scripts 27.*)
- get-starknet usage example: `/D/Starknet/starknet-ready-session`
- Full design spec: `docs/superpowers/specs/2026-05-11-anon-governance-dapp-design.md`

# Environment Variables
```env
NEXT_PUBLIC_GOVERNOR_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://...
BACKEND_ACCOUNT_ADDRESS=0x...
BACKEND_ACCOUNT_PRIVATE_KEY=0x...
PROOF_SERVER_URL=http://localhost:3030
```

# Language
Code and UI in English.
