import { RpcProvider } from "starknet";

export const GOVERNOR_ADDRESS = process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS!;
export const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS!;

// Client-side provider routes through /api/rpc — the Alchemy key stays server-only.
export const provider = new RpcProvider({ nodeUrl: "/api/rpc" });

// Distance between the chain head and the proof's reference block. Raise it if a prover rejects blocks too close to the head.
export const REFERENCE_BLOCK_LAG = 0;

export const CHAIN_POLL_INTERVAL_MS = 5_000;
