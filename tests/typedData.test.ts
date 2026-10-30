import { describe, it, expect } from "vitest";
import {
  buildAnonVoteTypedData,
  buildDelegationTypedData,
  ANON_VOTE_INTENT_TYPES,
  DELEGATION_TYPES,
} from "../src/app/utils/typedData";
import { typedData, TypedDataRevision } from "starknet";

describe("buildAnonVoteTypedData", () => {
  it("returns correct primaryType and domain", () => {
    const td = buildAnonVoteTypedData("0xabc", 1, "SN_MAIN");
    expect(td.primaryType).toBe("AnonVoteIntent");
    expect(td.domain.name).toBe("AnonGovernor");
    expect(td.domain.version).toBe("0x31");
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

describe("buildDelegationTypedData", () => {
  it("has the type hash of OpenZeppelin's Delegation", () => {
    // DELEGATION_TYPE_HASH of packages/governance/src/votes/delegation.cairo, in the OpenZeppelin fork the contracts build with
    expect(typedData.getTypeHash(DELEGATION_TYPES, "Delegation", TypedDataRevision.ACTIVE)).toBe(
      "0x29444c6b338056aafe1802658864510c2651f5cd23897cb7b7edafe5b126d4f",
    );
  });

  it("builds the message the token verifies", () => {
    const td = buildDelegationTypedData({
      token: "0x7",
      delegatee: "0x9",
      nonce: "0x3",
      expiry: 1700000000,
      chainId: "SN_SEPOLIA",
    });

    expect(td.primaryType).toBe("Delegation");
    expect(td.domain).toEqual({ name: "GovToken", version: "0x31", chainId: "SN_SEPOLIA", revision: "1" });
    expect(td.message).toEqual({ verifying_contract: "0x7", delegatee: "0x9", nonce: "0x3", expiry: "1700000000" });
  });
});
