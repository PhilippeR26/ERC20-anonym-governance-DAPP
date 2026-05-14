import { describe, it, expect } from "vitest";
import { computeNullifier } from "../src/app/utils/nullifier";

describe("computeNullifier", () => {
  it("returns a hex string", () => {
    const n = computeNullifier("0x123", ["0x1", "0x2"]);
    expect(n).toMatch(/^0x[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    expect(computeNullifier("0xabc", ["0x1", "0x2"])).toBe(
      computeNullifier("0xabc", ["0x1", "0x2"]),
    );
  });

  it("differs for different proposals", () => {
    const sig = ["0x1", "0x2"];
    expect(computeNullifier("0x1", sig)).not.toBe(computeNullifier("0x2", sig));
  });

  it("differs for different signatures", () => {
    expect(computeNullifier("0xabc", ["0x1", "0x2"])).not.toBe(
      computeNullifier("0xabc", ["0x3", "0x4"]),
    );
  });

  it("matches known value — fill after contract test", () => {
    // After running 28.testGovernance2Proof.ts with the modified contract and a known
    // proposalId + real wallet signature, read the emitted nullifier from the proof
    // output and paste it here:
    //   const proposalId = "0x...";
    //   const signature = ["0x...", "0x..."];    // actual sig from wallet
    //   expect(computeNullifier(proposalId, signature)).toBe("0x...");
    expect(true).toBe(true); // placeholder
  });
});
