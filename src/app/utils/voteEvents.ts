export type ProofProgress = { type: "queued"; position: number; etaSec: number } | { type: "started" };

export type VoteInput = { proposalId: string; support: number; voterAddress: string; signature: string[] };

export type VoteProgressEvent = ProofProgress | { type: "proved" };

export type VoteEvent =
  | VoteProgressEvent
  | { type: "submitted"; transactionHash: string }
  | { type: "error"; message: string };

// The vote route answers one JSON VoteEvent per line (NDJSON).
export async function readVoteStream(
  response: Response,
  onProgress: (e: VoteProgressEvent) => void,
): Promise<string> {
  if (!response.ok) throw new Error(`Vote request failed: HTTP ${response.status}`);

  const handle = (line: string): string | undefined => {
    if (!line.trim()) return undefined;
    const event = JSON.parse(line) as VoteEvent;
    if (event.type === "submitted") return event.transactionHash;
    if (event.type === "error") throw new Error(event.message);
    onProgress(event);
    return undefined;
  };

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const hash = handle(line);
      if (hash) return hash;
    }
  }
  const hash = handle(buffer + decoder.decode());
  if (hash) return hash;
  throw new Error("Vote stream ended without a transaction hash");
}
