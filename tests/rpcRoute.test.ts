import { describe, it, expect, vi, afterEach } from "vitest";
import { POST } from "../src/app/api/rpc/route";

function rpcRequest(body: unknown): Request {
  return new Request("http://localhost/api/rpc", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/rpc", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("answers a JSON-RPC error naming ALCHEMY_API_KEY when it is missing", async () => {
    vi.stubEnv("ALCHEMY_API_KEY", "");

    const res = await POST(rpcRequest({ jsonrpc: "2.0", id: 7, method: "starknet_chainId", params: [] }));

    expect(await res.json()).toEqual({
      jsonrpc: "2.0",
      id: 7,
      error: { code: -32603, message: "ALCHEMY_API_KEY is not set (required for network sepolia)" },
    });
  });

  it("forwards the body to the Alchemy URL of the network", async () => {
    vi.stubEnv("ALCHEMY_API_KEY", "k");
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return Response.json({ jsonrpc: "2.0", id: 7, result: "0x534e5f5345504f4c4941" });
    });
    const body = { jsonrpc: "2.0", id: 7, method: "starknet_chainId", params: [] };

    const res = await POST(rpcRequest(body));

    expect(calls).toEqual([
      { url: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/k", body },
    ]);
    expect(await res.json()).toEqual({ jsonrpc: "2.0", id: 7, result: "0x534e5f5345504f4c4941" });
  });
});
