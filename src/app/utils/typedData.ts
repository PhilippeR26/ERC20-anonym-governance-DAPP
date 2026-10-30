import { CairoBytes31, type TypedData } from "starknet";

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
      version: CairoBytes31.fromText("1").toHexString(),  // 0x31 — shortstring, not integer
      chainId,
      revision: "1",
    },
    message: {
      proposal_id: proposalId,
      support: String(support),
    },
  };
}

export const DELEGATION_TYPES: TypedData["types"] = {
  StarknetDomain: ANON_VOTE_INTENT_TYPES.StarknetDomain,
  Delegation: [
    { name: "verifying_contract", type: "ContractAddress" },
    { name: "delegatee",          type: "ContractAddress" },
    { name: "nonce",              type: "felt" },
    { name: "expiry",             type: "u128" },  // the token's expiry is a u64, but OpenZeppelin types it u128 (SNIP-12 has no u64)
  ],
};

// The message the token verifies in delegate_by_sig; its domain is the token's SNIP12Metadata (name 'GovToken', version '1').
export function buildDelegationTypedData(args: {
  token: string;
  delegatee: string;
  nonce: string;
  expiry: number;
  chainId: string;
}): TypedData {
  return {
    types: DELEGATION_TYPES,
    primaryType: "Delegation",
    domain: {
      name: "GovToken",
      version: CairoBytes31.fromText("1").toHexString(),
      chainId: args.chainId,
      revision: "1",
    },
    message: {
      verifying_contract: args.token,
      delegatee: args.delegatee,
      nonce: args.nonce,
      expiry: String(args.expiry),
    },
  };
}
