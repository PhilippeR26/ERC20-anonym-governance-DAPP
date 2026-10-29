import { describe, it, expect, vi, afterEach } from "vitest";
import { runVote } from "../src/app/server/castVote";

describe("runVote", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("stops before signing when the proof server is on another network", async () => {
    vi.stubEnv("PROOF_SERVER_INSTANCE_URL", "http://192.168.1.26:3031");
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      return new Response('{"ok":true,"network":"mainnet"}');
    });

    await expect(
      runVote({ proposalId: "0x1", support: 1, voterAddress: "0x2", signature: ["0x3", "0x4"] }, () => {}),
    ).rejects.toThrow("Proof server http://192.168.1.26:3031 proves mainnet, but this DApp runs on sepolia");
    expect(calls).toEqual(["http://192.168.1.26:3031/health"]);
  });
});
