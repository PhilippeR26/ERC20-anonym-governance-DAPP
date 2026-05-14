import { shortString, type TypedData } from "starknet";

export const ANON_VOTE_INTENT_TYPES: TypedData["types"] = {
  StarknetDomain: [
    { name: "name",     type: "shortstring" },
    { name: "version",  type: "shortstring" },
    { name: "chainId",  type: "shortstring" },
    { name: "revision", type: "shortstring" },
  ],
  AnonVoteIntent: [
    { name: "proposal_id", type: "felt" },
    { name: "support",     type: "felt" },
  ],
};

export function buildAnonVoteTypedData(proposalId: string, support: number, chainId: string): TypedData {
  return {
    types: ANON_VOTE_INTENT_TYPES,
    primaryType: "AnonVoteIntent",
    domain: {
      name: "AnonGovernor",
      version: shortString.encodeShortString("1"),  // 0x31 — shortstring, not integer
      chainId,
      revision: "1",
    },
    message: {
      proposal_id: proposalId,
      support: String(support),
    },
  };
}
