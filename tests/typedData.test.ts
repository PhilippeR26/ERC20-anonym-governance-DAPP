import { describe, it, expect } from "vitest";
import { buildAnonVoteTypedData, ANON_VOTE_INTENT_TYPES } from "../src/app/utils/typedData";
import { typedData } from "starknet";

describe("buildAnonVoteTypedData", () => {
  it("returns correct primaryType and domain", () => {
    const td = buildAnonVoteTypedData("0xabc", 1, "SN_MAIN");
    expect(td.primaryType).toBe("AnonVoteIntent");
    expect(td.domain.name).toBe("AnonGovernor");
    expect(td.domain.version).toBe("1");
    expect(td.domain.chainId).toBe("SN_MAIN");
  });

  it("encodes proposal_id and support as strings in message", () => {
    const td = buildAnonVoteTypedData("0xabc", 2, "SN_MAIN");
    const msg = td.message as { proposal_id: string; support: string };
    expect(msg.proposal_id).toBe("0xabc");
    expect(msg.support).toBe("2");
  });

  it("produces deterministic type hash", () => {
    const h1 = typedData.getTypeHash(ANON_VOTE_INTENT_TYPES, "AnonVoteIntent");
    const h2 = typedData.getTypeHash(ANON_VOTE_INTENT_TYPES, "AnonVoteIntent");
    expect(h1).toBe(h2);
    expect(h1).toBe("0x3922ad5e771b8914790ce766e38fd8ccfd7c4ee9712f51052372b9f3ee584a");
  });
});
