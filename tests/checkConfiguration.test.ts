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
    vi.stubEnv("PROOF_SERVER_URL", "https://proof.example");
    vi.stubEnv("PROOF_SERVER_API_KEY", "s");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns no problem for a complete configuration and a matching instance", async () => {
    const calls = stubHealth("sepolia");

    expect(await checkConfiguration()).toEqual([]);
    expect(calls).toEqual(["https://proof.example/sepolia/health"]);
  });

  it("adds the health problem of the proof server, without its address", async () => {
    stubHealth("mainnet");

    expect(await checkConfiguration()).toEqual(["Proof server proves mainnet, but this DApp runs on sepolia"]);
  });

  it("lists missing variables without calling the proof server when its address is missing", async () => {
    vi.stubEnv("PROOF_SERVER_URL", "");
    const calls = stubHealth("sepolia");

    const problems = await checkConfiguration();

    expect(problems).toContain("PROOF_SERVER_URL is not set (required for network sepolia)");
    expect(calls).toEqual([]);
  });

  it("lists a missing key without calling the proof server", async () => {
    vi.stubEnv("PROOF_SERVER_API_KEY", "");
    const calls = stubHealth("sepolia");

    expect(await checkConfiguration()).toEqual(["PROOF_SERVER_API_KEY is not set (required for network sepolia)"]);
    expect(calls).toEqual([]);
  });
});
