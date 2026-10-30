import { describe, it, expect, vi, afterEach } from "vitest";
import { runVote } from "../src/app/server/castVote";

describe("runVote", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stops before signing when the proof server is on another network", async () => {
    vi.stubEnv("PROOF_SERVER_URL", "https://proof.example");
    vi.stubEnv("PROOF_SERVER_API_KEY", "s");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      return new Response('{"ok":true,"network":"mainnet"}');
    });

    await expect(
      runVote({ proposalId: "0x1", support: 1, voterAddress: "0x2", signature: ["0x3", "0x4"] }, () => {}),
    ).rejects.toThrow("Proof server proves mainnet, but this DApp runs on sepolia");
    expect(calls).toEqual(["https://proof.example/sepolia/health"]);
  });
});
