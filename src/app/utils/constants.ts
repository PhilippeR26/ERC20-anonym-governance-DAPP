import { RpcProvider } from "starknet";
import { NETWORK } from "./network";

export const GOVERNOR_ADDRESS = NETWORK.governorAddress;
export const TOKEN_ADDRESS = NETWORK.tokenAddress;

// Client-side provider routes through /api/rpc — the Alchemy key stays server-only.
export const provider = new RpcProvider({ nodeUrl: "/api/rpc" });

// Distance between the chain head and the proof's reference block. Raise it if a prover rejects blocks too close to the head.
export const REFERENCE_BLOCK_LAG = 0;

export const CHAIN_POLL_INTERVAL_MS = 5_000;
