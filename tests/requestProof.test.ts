import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { INVOKE_TXN_V3 } from "@starknet-io/types-js";
import { checkProofServerHealth, requestProof } from "../src/app/server/requestProof";
import type { ProofProgress } from "../src/app/utils/voteEvents";

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

const TARGET = { url: "http://192.168.1.26:3030" };
const PUBLIC = { url: "https://proof.example/sepolia", apiKey: "s" };

type RecordedRequest = { url: string; method: string; headers: Headers; body: unknown };
type FakeReply = {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  chunks?: string[];
};

// Answers by path suffix ("/health", "/prove"); an Error value makes fetch reject.
function fakeProofServer(routes: Record<string, FakeReply | Error>): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    requests.push({
      url,
      method: init.method ?? "GET",
      headers: new Headers(init.headers),
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    const suffix = Object.keys(routes).find((path) => url.endsWith(path));
    const reply = suffix ? routes[suffix] : { status: 404, body: "Not found" };
    if (reply instanceof Error) throw reply;
    const chunks = reply.chunks ?? (reply.body !== undefined ? [reply.body] : []);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    return new Response(stream, { status: reply.status ?? 200, statusText: reply.statusText, headers: reply.headers });
  });
  return requests;
}

const DONE_EVENT = `event: done\ndata: ${JSON.stringify({
  proof: "AAAAproof",
  proofFacts: ["0x0", "0x0", "0x5678"],
  l2ToL1Messages: [{ from_address: "0xabc", to_address: "0x0", payload: ["0x7"] }],
})}\n\n`;

const far = () => Date.now() + 300_000;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("checkProofServerHealth", () => {
  it("returns null when the instance is on the expected network", async () => {
    const requests = fakeProofServer({
      "/health": { body: '{"ok":true,"network":"sepolia","queueLength":0,"running":0}' },
    });

    expect(await checkProofServerHealth(TARGET, "sepolia")).toBeNull();
    expect(requests[0].url).toBe("http://192.168.1.26:3030/health");
  });

  it("names both networks on a mismatch", async () => {
    fakeProofServer({ "/health": { body: '{"ok":true,"network":"mainnet"}' } });

    expect(await checkProofServerHealth(TARGET, "sepolia")).toBe(
      "Proof server http://192.168.1.26:3030 proves mainnet, but this DApp runs on sepolia",
    );
  });

  it("reports an unreachable server", async () => {
    fakeProofServer({ "/health": new TypeError("fetch failed") });

    expect(await checkProofServerHealth(TARGET, "sepolia")).toBe(
      "Proof server http://192.168.1.26:3030 is unreachable: fetch failed",
    );
  });

  it("reports an HTML 404 from the reverse proxy as unreachable", async () => {
    fakeProofServer({ "/health": { status: 404, body: "Not found" } });

    expect(await checkProofServerHealth(TARGET, "sepolia")).toBe(
      "Proof server http://192.168.1.26:3030 is unreachable: HTTP 404",
    );
  });

  it("reports a server that is not ready", async () => {
    fakeProofServer({ "/health": { body: '{"ok":false,"network":"sepolia"}' } });

    expect(await checkProofServerHealth(TARGET, "sepolia")).toBe(
      "Proof server http://192.168.1.26:3030 reports it is not ready",
    );
  });
});

describe("requestProof", () => {
  it("posts the block and transaction to <url>/prove and returns the done result", async () => {
    const requests = fakeProofServer({
      "/prove": {
        chunks: ['event: log\ndata: {"stream":"stdout","line":"proving"}\n\n', DONE_EVENT.slice(0, 25), DONE_EVENT.slice(25)],
      },
    });

    const result = await requestProof(17029070, TX, { target: TARGET, deadline: far() });

    expect(result).toEqual({
      proof: "AAAAproof",
      proofFacts: ["0x0", "0x0", "0x5678"],
      l2ToL1Messages: [{ from_address: "0xabc", to_address: "0x0", payload: ["0x7"] }],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url).toBe("http://192.168.1.26:3030/prove");
    expect(requests[0].body).toEqual({ blockNumber: 17029070, tx: TX });
  });

  it("sends the key as a Bearer token on the public listener", async () => {
    const requests = fakeProofServer({ "/prove": { chunks: [DONE_EVENT] } });

    await requestProof(1, TX, { target: PUBLIC, deadline: far() });

    expect(requests[0].url).toBe("https://proof.example/sepolia/prove");
    expect(requests[0].headers.get("authorization")).toBe("Bearer s");
  });

  it("sends no Authorization header without a key", async () => {
    const requests = fakeProofServer({ "/prove": { chunks: [DONE_EVENT] } });

    await requestProof(1, TX, { target: TARGET, deadline: far() });

    expect(requests[0].headers.get("authorization")).toBeNull();
  });

  it("builds the refusal message from reason, error and Retry-After", async () => {
    fakeProofServer({
      "/prove": {
        status: 429,
        headers: { "Retry-After": "3600" },
        body: '{"reason":"quota_exceeded","error":"Daily quota used up"}',
      },
    });

    await expect(requestProof(1, TX, { target: PUBLIC, deadline: far() })).rejects.toThrow(
      "Proof server refused the request: 429 quota_exceeded — Daily quota used up; retry after 3600 s",
    );
  });

  it("falls back to the status text when the refusal is not JSON", async () => {
    fakeProofServer({ "/prove": { status: 502, statusText: "Bad Gateway", body: "<html>" } });

    await expect(requestProof(1, TX, { target: PUBLIC, deadline: far() })).rejects.toThrow(
      "Proof server refused the request: 502 Bad Gateway",
    );
  });

  it("forwards queued and started in order", async () => {
    const seen: ProofProgress[] = [];
    fakeProofServer({
      "/prove": {
        chunks: ['event: queued\ndata: {"position":2,"etaSec":90}\n\n', "event: started\ndata: {}\n\n", DONE_EVENT],
      },
    });

    await requestProof(1, TX, { target: TARGET, deadline: far(), onProgress: (p) => seen.push(p) });

    expect(seen).toEqual([{ type: "queued", position: 2, etaSec: 90 }, { type: "started" }]);
  });

  it("stops when the announced wait exceeds the budget", async () => {
    fakeProofServer({
      "/prove": { chunks: ['event: queued\ndata: {"position":9,"etaSec":900}\n\n', DONE_EVENT] },
    });

    await expect(requestProof(1, TX, { target: TARGET, deadline: Date.now() + 60_000 })).rejects.toThrow(
      "Proof server queue is too long (~900 s); try again later",
    );
  });

  it("fails with the message of an error event", async () => {
    fakeProofServer({ "/prove": { chunks: ['event: error\ndata: {"message":"prover crashed"}\n\n'] } });

    await expect(requestProof(1, TX, { target: TARGET, deadline: far() })).rejects.toThrow(
      "Proof server error: prover crashed",
    );
  });

  it("fails when the stream ends without done", async () => {
    fakeProofServer({ "/prove": { chunks: [] } });

    await expect(requestProof(1, TX, { target: TARGET, deadline: far() })).rejects.toThrow(
      "Proof server returned no result",
    );
  });

  it("returns an empty message list when done has no l2ToL1Messages", async () => {
    fakeProofServer({
      "/prove": { chunks: [`event: done\ndata: ${JSON.stringify({ proof: "P", proofFacts: ["0x1"] })}\n\n`] },
    });

    const result = await requestProof(1, TX, { target: TARGET, deadline: far() });

    expect(result.l2ToL1Messages).toEqual([]);
  });

  it("logs the proving duration", async () => {
    fakeProofServer({ "/prove": { chunks: [DONE_EVENT] } });

    await requestProof(1, TX, { target: TARGET, deadline: far() });

    const logged = vi.mocked(console.log).mock.calls.map((args) => args.join(" ")).join("\n");
    expect(logged).toMatch(/proof server.*\d+\.\d s/i);
  });
});

describe("requestProof cancellation", () => {
  // A proof-server stream that stays open after one queued event until the request is aborted.
  function hangingServer(): { aborted: () => boolean } {
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit = {}) => {
      requestSignal = init.signal as AbortSignal;
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('event: queued\ndata: {"position":1,"etaSec":10}\n\n'));
          requestSignal!.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
        },
      });
      return new Response(stream, { status: 200 });
    });
    return { aborted: () => requestSignal?.aborted === true };
  }

  it("aborts the proof-server request when the caller's signal aborts", { timeout: 2000 }, async () => {
    const server = hangingServer();
    const caller = new AbortController();

    const call = requestProof(1, TX, {
      target: TARGET,
      deadline: far(),
      signal: caller.signal,
      onProgress: () => caller.abort(),
    });

    await expect(call).rejects.toThrow();
    expect(server.aborted()).toBe(true);
  });

  it("aborts the proof-server request when onProgress throws", { timeout: 2000 }, async () => {
    const server = hangingServer();

    const call = requestProof(1, TX, {
      target: TARGET,
      deadline: far(),
      onProgress: () => {
        throw new Error("client gone");
      },
    });

    await expect(call).rejects.toThrow("client gone");
    expect(server.aborted()).toBe(true);
  });
});
