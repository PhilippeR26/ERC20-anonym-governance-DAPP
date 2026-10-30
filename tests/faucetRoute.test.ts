import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { config } from "starknet";
import { POST } from "../src/app/api/faucet/route";
import { fakeStarknetNode } from "./helpers/fakeStarknetNode";

function post(body: unknown): Request {
  return new Request("http://localhost/api/faucet", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/faucet", () => {
  beforeEach(() => {
    vi.stubEnv("ALCHEMY_API_KEY", "k");
    vi.stubEnv("SEPOLIA_BACKEND_ACCOUNT_ADDRESS", "0xa");
    vi.stubEnv("SEPOLIA_BACKEND_ACCOUNT_PRIVATE_KEY", "0xb");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    config.delete("fetch");
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("answers an undeployed account with the reason, as data", async () => {
    const node = fakeStarknetNode(
      {},
      { starknet_getClassHashAt: { error: { code: 20, message: "Contract not found" } } },
    );
    config.set("fetch", node.fetch);

    const res = await POST(post({ address: "0x1234", nonce: "0x0", expiry: 1_800_000_000, signature: ["0x1", "0x2"] }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^This account is not deployed yet: /);
  });

  it("refuses a body without signature", async () => {
    const res = await POST(post({ address: "0x1234", nonce: "0x0", expiry: 1_800_000_000 }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request" });
  });

  it("refuses a body that is not JSON", async () => {
    const res = await POST(post("not json"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request" });
  });
});
