import type { CairoCustomEnum, Call, Contract, RpcProvider } from "starknet";
import { contractReason } from "./contractReason";

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
