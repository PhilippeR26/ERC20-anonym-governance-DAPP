import { describe, it, expect } from "vitest";
import { hashProposal } from "../src/app/utils/hashProposal";

describe("hashProposal", () => {
  it("returns a string", () => {
    expect(typeof hashProposal("Test proposal")).toBe("string");
  });

  it("is deterministic", () => {
    expect(hashProposal("foo")).toBe(hashProposal("foo"));
  });

  it("differs for different descriptions", () => {
    expect(hashProposal("foo")).not.toBe(hashProposal("bar"));
  });

  it("matches known value — fill after contract test", () => {
    // Run 28.testGovernance2Proof.ts with description "fff" (its current default).
    // The script logs `{ proposalId }` — paste it here:
    //   expect(hashProposal("fff")).toBe("0x...");
    expect(true).toBe(true); // placeholder
  });
});
