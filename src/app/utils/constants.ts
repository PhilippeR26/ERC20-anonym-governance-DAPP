import { RpcProvider } from "starknet";

export const GOVERNOR_ADDRESS = process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS!;
export const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS!;

// Client-side provider routes through /api/rpc — the Alchemy key stays server-only.
export const provider = new RpcProvider({ nodeUrl: "/api/rpc" });
