import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../src/app/api/rpc/route";
import { NETWORK } from "../src/app/utils/network";

function rpcRequest(body: unknown): Request {
  return new Request("http://localhost/api/rpc", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// Records what reaches Alchemy; every request is answered with the same result.
function stubAlchemy(): { url: string; body: unknown }[] {
  vi.stubEnv("ALCHEMY_API_KEY", "k");
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const body = JSON.parse(init.body as string);
    calls.push({ url, body });
    return Response.json({ jsonrpc: "2.0", id: body.id, result: "0x1" });
  });
  return calls;
}

const callRequest = (contractAddress: unknown, params?: unknown) => ({
  jsonrpc: "2.0",
  id: 3,
  method: "starknet_call",
  params: params ?? {
    request: { contract_address: contractAddress, entry_point_selector: "0x1", calldata: [] },
    block_id: "latest",
  },
});

describe("POST /api/rpc", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it.each([
    "starknet_specVersion",
    "starknet_chainId",
    "starknet_blockNumber",
    "starknet_getTransactionStatus",
    "starknet_getTransactionReceipt",
  ])("relays %s", async (method) => {
    const calls = stubAlchemy();

    const res = await POST(rpcRequest({ jsonrpc: "2.0", id: 5, method, params: [] }));

    expect(calls).toHaveLength(1);
    expect(await res.json()).toEqual({ jsonrpc: "2.0", id: 5, result: "0x1" });
  });

  it("relays starknet_call on the governor and the token, whatever the zero padding of the address", async () => {
    const calls = stubAlchemy();
    const padded = `0x000${NETWORK.governorAddress.slice(2)}`;

    for (const address of [NETWORK.governorAddress, NETWORK.tokenAddress, padded]) {
      await POST(rpcRequest(callRequest(address)));
    }

    expect(calls).toHaveLength(3);
  });

  it("refuses starknet_call on any other contract, without calling Alchemy", async () => {
    const calls = stubAlchemy();

    const res = await POST(rpcRequest(callRequest("0x123")));

    expect(await res.json()).toEqual({
      jsonrpc: "2.0",
      id: 3,
      error: { code: -32601, message: "starknet_call is only relayed for the governor and the token" },
    });
    expect(calls).toEqual([]);
  });

  it("refuses starknet_call whose contract address is not a number", async () => {
    const calls = stubAlchemy();

    const res = await POST(rpcRequest(callRequest("not-an-address")));

    expect((await res.json()).error.code).toBe(-32601);
    expect(calls).toEqual([]);
  });

  it("refuses starknet_call without a request", async () => {
    const calls = stubAlchemy();

    const res = await POST(rpcRequest(callRequest(undefined, [])));

    expect((await res.json()).error.code).toBe(-32601);
    expect(calls).toEqual([]);
  });

  it("refuses a method the DApp does not use, names it in the log, and does not call Alchemy", async () => {
    const calls = stubAlchemy();

    const res = await POST(rpcRequest({ jsonrpc: "2.0", id: 9, method: "starknet_addInvokeTransaction", params: {} }));

    expect(await res.json()).toEqual({
      jsonrpc: "2.0",
      id: 9,
      error: { code: -32601, message: "Method starknet_addInvokeTransaction is not relayed by this DApp" },
    });
    expect(calls).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("starknet_addInvokeTransaction"));
  });

  it("refuses a batch of requests", async () => {
    const calls = stubAlchemy();

    const res = await POST(rpcRequest([{ jsonrpc: "2.0", id: 1, method: "starknet_chainId", params: [] }]));

    expect(await res.json()).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Only single requests are relayed" },
    });
    expect(calls).toEqual([]);
  });

  it("answers a parse error to a body that is not JSON", async () => {
    const calls = stubAlchemy();

    const res = await POST(rpcRequest("not json"));

    expect(await res.json()).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
    expect(calls).toEqual([]);
  });
});
