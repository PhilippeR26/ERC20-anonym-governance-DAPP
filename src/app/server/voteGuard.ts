import { RpcError, type CairoCustomEnum, type Call, type Contract, type RpcProvider } from "starknet";

// A contract that panics makes the node answer error 40 with the reason as a short string: "0x4e75… ('Nullifier already used')".
// When the failing call is nested (the voter's account), the innermost reason comes last.
function contractReason(e: unknown): string | undefined {
  if (!(e instanceof RpcError) || !e.isType("CONTRACT_ERROR")) return undefined;
  return [...JSON.stringify(e.baseError.data ?? "").matchAll(/\('([^']*)'\)/g)].at(-1)?.[1];
}

// Free reads that tell, before a proof is asked for, whether the vote can succeed. create_proof does not check that the
// proposal is Active (only cast_anonymous_vote does): without the state check, one signature could be replayed on a
// closed proposal for ever, one proof each time.
export async function checkVoteRequest(
  provider: RpcProvider,
  gov: Contract,
  proposalId: string,
  createProof: Call,
): Promise<string | null> {
  try {
    const state = ((await gov.state(proposalId)) as CairoCustomEnum).activeVariant();
    if (state !== "Active") return `Vote refused: the proposal is ${state}, not Active`;
    await provider.callContract(createProof);
    return null;
  } catch (e) {
    const reason = contractReason(e);
    if (reason === undefined) throw e;
    return `Vote refused: ${reason}`;
  }
}
