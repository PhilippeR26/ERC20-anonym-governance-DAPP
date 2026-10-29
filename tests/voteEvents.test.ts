import { describe, it, expect } from "vitest";
import { readVoteStream, type VoteProgressEvent } from "../src/app/utils/voteEvents";

function ndjsonResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status });
}

describe("readVoteStream", () => {
  it("forwards progress and resolves the transaction hash", async () => {
    const seen: VoteProgressEvent[] = [];

    const hash = await readVoteStream(
      ndjsonResponse([
        '{"type":"queued","position":1,"etaSec":45}\n',
        '{"type":"started"}\n{"type":"proved"}\n',
        '{"type":"submitted","transactionHash":"0xabc"}\n',
      ]),
      (e) => seen.push(e),
    );

    expect(hash).toBe("0xabc");
    expect(seen).toEqual([{ type: "queued", position: 1, etaSec: 45 }, { type: "started" }, { type: "proved" }]);
  });

  it("parses an event split across chunks", async () => {
    const hash = await readVoteStream(
      ndjsonResponse(['{"type":"submitted","transa', 'ctionHash":"0xdef"}\n']),
      () => {},
    );

    expect(hash).toBe("0xdef");
  });

  it("rejects with the message of an error event", async () => {
    await expect(readVoteStream(ndjsonResponse(['{"type":"error","message":"boom"}\n']), () => {})).rejects.toThrow(
      "boom",
    );
  });

  it("rejects when the stream ends without a hash", async () => {
    await expect(readVoteStream(ndjsonResponse(['{"type":"proved"}\n']), () => {})).rejects.toThrow(
      "Vote stream ended without a transaction hash",
    );
  });

  it("rejects a non-2xx answer", async () => {
    await expect(readVoteStream(ndjsonResponse([], 500), () => {})).rejects.toThrow("Vote request failed: HTTP 500");
  });
});
