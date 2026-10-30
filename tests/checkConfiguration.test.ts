import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkConfiguration } from "../src/app/server/checkConfiguration";

function stubHealth(network: string): string[] {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify({ ok: true, network, queueLength: 0, running: 0 }));
  });
  return calls;
}

describe("checkConfiguration", () => {
  beforeEach(() => {
    vi.stubEnv("ALCHEMY_API_KEY", "k");
    vi.stubEnv("SEPOLIA_BACKEND_ACCOUNT_ADDRESS", "0xa");
    vi.stubEnv("SEPOLIA_BACKEND_ACCOUNT_PRIVATE_KEY", "0xb");
    vi.stubEnv("PROOF_SERVER_INSTANCE_URL", "http://192.168.1.26:3030");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns no problem for a complete configuration and a matching instance", async () => {
    stubHealth("sepolia");

    expect(await checkConfiguration()).toEqual([]);
  });

  it("adds the health problem of the proof server", async () => {
    stubHealth("mainnet");

    expect(await checkConfiguration()).toEqual([
      "Proof server http://192.168.1.26:3030 proves mainnet, but this DApp runs on sepolia",
    ]);
  });

  it("lists missing variables without calling the proof server when its address is missing", async () => {
    vi.stubEnv("PROOF_SERVER_INSTANCE_URL", "");
    vi.stubEnv("PROOF_SERVER_URL", "");
    const calls = stubHealth("sepolia");

    const problems = await checkConfiguration();

    expect(problems).toContain("PROOF_SERVER_URL is not set (required for network sepolia)");
    expect(calls).toEqual([]);
  });
});
