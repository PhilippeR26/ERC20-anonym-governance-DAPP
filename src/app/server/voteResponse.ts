import type { VoteEvent, VoteProgressEvent } from "@/app/utils/voteEvents";

// Streamed so that queue progress reaches the browser while the proof runs, and errors arrive as data:
// Next.js hides the message of an error thrown by a Server Action in production.
export function voteResponse(run: (emit: (e: VoteProgressEvent) => void) => Promise<string>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: VoteEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        send({ type: "submitted", transactionHash: await run(send) });
      } catch (e) {
        console.error("Vote failed:", e);
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
