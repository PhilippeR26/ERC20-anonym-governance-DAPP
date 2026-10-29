import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { INVOKE_TXN_V3 } from "@starknet-io/types-js";
import { requestProof } from "../src/app/server/requestProof";

const TX = {
  type: "INVOKE",
  sender_address: "0x7e00d496e324876bbc8531f2d9a82bf154d1a04a50218ee74cdd372f75a551a",
  calldata: ["0x1", "0x482f5d9c2e3a7b1f4c6d8e0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0"],
  version: "0x3",
  signature: ["0x226ea8e8", "0x3bf5dde3"],
  nonce: "0x7",
  resource_bounds: {
    l2_gas: { max_amount: "0x76df40", max_price_per_unit: "0x0" },
    l1_gas: { max_amount: "0x2377e", max_price_per_unit: "0x0" },
    l1_data_gas: { max_amount: "0x240", max_price_per_unit: "0x0" },
  },
  tip: "0x0",
  paymaster_data: [],
  account_deployment_data: [],
  nonce_data_availability_mode: "L1",
  fee_data_availability_mode: "L1",
} as INVOKE_TXN_V3;

type RecordedRequest = { url: string; method: string; headers: Headers; body: unknown };

function fakeServer(status: number, chunks: string[]): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    requests.push({
      url,
      method: init.method ?? "GET",
      headers: new Headers(init.headers),
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    return new Response(stream, { status });
  });
  return requests;
}

const LOCAL_DONE_EVENT = `event: done\ndata: ${JSON.stringify({
  proof: "AAAAlocal",
  proofFacts: ["0x0", "0x0", "0x5678"],
  l2ToL1Messages: [{ from_address: "0xabc", to_address: "0x0", payload: ["0x7"] }],
})}\n\n`;

describe("requestProof (local proof server)", () => {
  beforeEach(() => {
    process.env.PROVER = "local";
    process.env.PROOF_SERVER_URL = "http://127.0.0.1:3030";
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.PROVER;
    delete process.env.PROOF_SERVER_URL;
  });

  it("posts the block and transaction to the local server and returns the proof of the done event", async () => {
    const requests = fakeServer(200, [
      'event: log\ndata: {"stream":"stdout","line":"proving"}\n\n',
      LOCAL_DONE_EVENT.slice(0, 25),
      LOCAL_DONE_EVENT.slice(25),
    ]);

    const result = await requestProof(17029070, TX);

    expect(result).toEqual({
      proof: "AAAAlocal",
      proofFacts: ["0x0", "0x0", "0x5678"],
      l2ToL1Messages: [{ from_address: "0xabc", to_address: "0x0", payload: ["0x7"] }],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url).toBe("http://127.0.0.1:3030/prove");
    expect(requests[0].body).toEqual({ blockNumber: 17029070, tx: TX });
  });

  it("uses the local server when PROVER is not set", async () => {
    delete process.env.PROVER;
    const requests = fakeServer(200, [LOCAL_DONE_EVENT]);

    await requestProof(17029070, TX);

    expect(requests[0].url).toBe("http://127.0.0.1:3030/prove");
  });

  it("returns an empty message list when the done event has no l2ToL1Messages", async () => {
    fakeServer(200, [`event: done\ndata: ${JSON.stringify({ proof: "P", proofFacts: ["0x1"] })}\n\n`]);

    const result = await requestProof(17029070, TX);

    expect(result.l2ToL1Messages).toEqual([]);
  });

  it("throws the message of the error event", async () => {
    fakeServer(200, ['event: error\ndata: {"message":"snip36 exited with code 1"}\n\n']);

    await expect(requestProof(17029070, TX)).rejects.toThrow(/snip36 exited with code 1/);
  });

  it("throws with the HTTP status when the local server refuses the request", async () => {
    fakeServer(400, ['{"error":"blockNumber and tx are required"}']);

    const call = requestProof(17029070, TX);

    await expect(call).rejects.toThrow(/400/);
    await expect(call).rejects.toThrow(/blockNumber and tx are required/);
  });

  it("logs the local proving duration", async () => {
    fakeServer(200, [LOCAL_DONE_EVENT]);

    await requestProof(17029070, TX);

    const logged = vi.mocked(console.log).mock.calls.map((args) => args.join(" ")).join("\n");
    expect(logged).toMatch(/local proof server.*\d+\.\d s/i);
  });

  it("refuses an unknown PROVER value instead of calling a server", async () => {
    process.env.PROVER = "starkscan";
    const requests = fakeServer(200, [LOCAL_DONE_EVENT]);

    await expect(requestProof(17029070, TX)).rejects.toThrow(/PROVER/);
    expect(requests).toHaveLength(0);
  });
});

describe("requestProof (proof gateway)", () => {
  beforeEach(() => {
    process.env.PROVER = "gateway";
    process.env.PROOF_GATEWAY_URL = "https://gateway.example";
    process.env.PROOF_GATEWAY_API_KEY = "gw-key";
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.PROVER;
    delete process.env.PROOF_GATEWAY_URL;
    delete process.env.PROOF_GATEWAY_API_KEY;
  });

  it("sends a starknet_proveTransaction JSON-RPC request with the API key and returns the proof", async () => {
    const requests = fakeServer(200, [
      JSON.stringify({
        result: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            proof: "AAAAgateway",
            proofFacts: ["0x0", "0x9"],
            l2ToL1Messages: [{ from_address: "0xabc", to_address: "0x0", payload: ["0x8"] }],
          },
        },
        remaining_quota: -1,
      }),
    ]);

    const result = await requestProof(17029070, TX);

    expect(result).toEqual({
      proof: "AAAAgateway",
      proofFacts: ["0x0", "0x9"],
      l2ToL1Messages: [{ from_address: "0xabc", to_address: "0x0", payload: ["0x8"] }],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url).toBe("https://gateway.example/v1/prove");
    expect(requests[0].headers.get("x-api-key")).toBe("gw-key");
    expect(requests[0].body).toEqual({
      payload: {
        jsonrpc: "2.0",
        id: 1,
        method: "starknet_proveTransaction",
        params: { block_id: { block_number: 17029070 }, transaction: TX },
      },
    });
  });

  it("accepts snake_case result keys", async () => {
    fakeServer(200, [
      JSON.stringify({
        result: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            proof: "AAAAgateway",
            proof_facts: ["0x0", "0x9"],
            l2_to_l1_messages: [{ from_address: "0xabc", to_address: "0x0", payload: ["0x8"] }],
          },
        },
      }),
    ]);

    const result = await requestProof(17029070, TX);

    expect(result.proofFacts).toEqual(["0x0", "0x9"]);
    expect(result.l2ToL1Messages).toEqual([{ from_address: "0xabc", to_address: "0x0", payload: ["0x8"] }]);
  });

  it("throws with the HTTP status and body when the gateway refuses the request", async () => {
    fakeServer(502, [
      '{"detail":"Prover JSON-RPC error -32603: Internal error: Transaction execution failed: Failed to convert block header to block info: Invalid Starknet version: [0, 14, 4]"}',
    ]);

    const call = requestProof(17029070, TX);

    await expect(call).rejects.toThrow(/502/);
    await expect(call).rejects.toThrow(/Invalid Starknet version/);
  });

  it("throws the JSON-RPC error returned by the prover", async () => {
    fakeServer(200, [
      JSON.stringify({ result: { jsonrpc: "2.0", id: 1, error: { code: 55, message: "Account validation failed" } } }),
    ]);

    await expect(requestProof(17029070, TX)).rejects.toThrow(/Account validation failed/);
  });

  it("refuses to call the gateway without its URL", async () => {
    delete process.env.PROOF_GATEWAY_URL;
    const requests = fakeServer(200, ["{}"]);

    await expect(requestProof(17029070, TX)).rejects.toThrow(/PROOF_GATEWAY_URL/);
    expect(requests).toHaveLength(0);
  });
});
