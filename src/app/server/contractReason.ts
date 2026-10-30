import { RpcError } from "starknet";

// A contract that panics makes the node answer error 40 (or 41 when it happens while estimating a fee) with the reason
// as a short string: "0x4e75… ('Nullifier already used')". When the failing call is nested (the voter's account),
// the innermost reason comes last.
export function contractReason(e: unknown): string | undefined {
  if (!(e instanceof RpcError) || !(e.isType("CONTRACT_ERROR") || e.isType("TRANSACTION_EXECUTION_ERROR"))) {
    return undefined;
  }
  return [...JSON.stringify(e.baseError.data ?? "").matchAll(/\('([^']*)'\)/g)].at(-1)?.[1];
}
