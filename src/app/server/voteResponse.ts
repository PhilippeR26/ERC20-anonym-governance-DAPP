import type { VoteEvent, VoteProgressEvent } from "@/app/utils/voteEvents";
import { errorMessage } from "./errorMessage";

// Streamed so that queue progress reaches the browser while the proof runs, and errors arrive as data:
// Next.js hides the message of an error thrown by a Server Action in production.
// `signal` aborts when the browser leaves (page reload, tab closed): the run must then stop waiting for a proof.
export function voteResponse(
  run: (emit: (e: VoteProgressEvent) => void, signal: AbortSignal) => Promise<string>,
): Response {
  const encoder = new TextEncoder();
  const clientGone = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: VoteEvent) => {
        if (clientGone.signal.aborted) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        send({ type: "submitted", transactionHash: await run(send, clientGone.signal) });
      } catch (e) {
        console.error("Vote failed:", e);
        send({ type: "error", message: errorMessage(e) });
      }
      if (!clientGone.signal.aborted) controller.close();
    },
    cancel() {
      clientGone.abort();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
