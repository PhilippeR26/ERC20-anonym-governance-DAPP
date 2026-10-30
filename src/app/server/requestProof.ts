import type { INVOKE_TXN_V3 } from "@starknet-io/types-js";
import type { BigNumberish } from "starknet";
import type { NetworkName } from "@/app/utils/network";
import type { ProofProgress } from "@/app/utils/voteEvents";
import type { ProofServerTarget } from "./serverConfig";

type ProofMessage = {
  from_address: BigNumberish;
  payload: BigNumberish[];
  to_address: BigNumberish;
};

export type ProveResult = {
  proof: string;
  proofFacts: BigNumberish[];
  l2ToL1Messages: ProofMessage[];
};

export const HEALTH_TIMEOUT_MS = 10_000;

// Proof server v2 (secure-voty proofServer): GET /health, then POST /prove answered by a Server-Sent Events stream.
export async function checkProofServerHealth(
  target: ProofServerTarget,
  expected: NetworkName,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(`${target.url}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
  } catch (e) {
    return `Proof server ${target.url} is unreachable: ${errorText(e)}`;
  }
  if (!response.ok) return `Proof server ${target.url} is unreachable: HTTP ${response.status}`;
  let health: { ok?: boolean; network?: string };
  try {
    health = await response.json();
  } catch {
    return `Proof server ${target.url} is unreachable: not a proof server answer`;
  }
  if (!health.ok) return `Proof server ${target.url} reports it is not ready`;
  if (health.network !== expected) {
    return `Proof server ${target.url} proves ${health.network}, but this DApp runs on ${expected}`;
  }
  return null;
}

export async function requestProof(
  referenceBlock: number,
  tx: INVOKE_TXN_V3,
  options: {
    target: ProofServerTarget;
    deadline: number;
    onProgress?: (p: ProofProgress) => void;
    signal?: AbortSignal;
  },
): Promise<ProveResult> {
  const { target, deadline, onProgress, signal } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(0, deadline - Date.now()));
  // The caller's signal (the browser left) cancels the request too: the proof server drops a job when its client disconnects.
  const abortOnSignal = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abortOnSignal, { once: true });
  const startedAt = Date.now();

  try {
    const response = await fetch(`${target.url}/prove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(target.apiKey ? { Authorization: `Bearer ${target.apiKey}` } : {}),
      },
      body: JSON.stringify({ blockNumber: referenceBlock, tx }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(await refusalMessage(response));

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let proofRes: { proof: string; proofFacts: BigNumberish[]; l2ToL1Messages?: ProofMessage[] } | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";

      for (const message of messages) {
        const event = message.match(/^event: (\w+)/)?.[1];
        const data = message.match(/^data: (.+)$/m)?.[1];
        if (!event || !data) continue;
        const payload = JSON.parse(data);
        if (event === "queued") {
          if (Date.now() + payload.etaSec * 1000 > deadline) {
            // The proof server cancels a queued job as soon as its client disconnects.
            controller.abort();
            throw new Error(`Proof server queue is too long (~${payload.etaSec} s); try again later`);
          }
          onProgress?.({ type: "queued", position: payload.position, etaSec: payload.etaSec });
        }
        if (event === "started") onProgress?.({ type: "started" });
        if (event === "log") console.log(`[proof-server][${payload.stream}]`, payload.line);
        if (event === "done") proofRes = payload;
        if (event === "error") throw new Error(`Proof server error: ${payload.message}`);
      }
    }

    console.log(`Proof server ${target.url}: ${proofRes ? "done" : "no result"} after ${seconds(Date.now() - startedAt)}`);
    if (!proofRes) throw new Error("Proof server returned no result");
    return {
      proof: proofRes.proof,
      proofFacts: proofRes.proofFacts,
      l2ToL1Messages: proofRes.l2ToL1Messages ?? [],
    };
  } catch (e) {
    if (timedOut) throw new Error("Proof server did not answer within the time budget");
    throw e;
  } finally {
    // Whatever the way out (including an error thrown by onProgress), release the proof server's queue slot.
    controller.abort();
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortOnSignal);
  }
}

async function refusalMessage(response: Response): Promise<string> {
  let reason = response.statusText;
  let error = "";
  try {
    const body = (await response.json()) as { reason?: string; error?: string };
    reason = body.reason ?? reason;
    error = body.error ?? "";
  } catch {
    // not JSON (e.g. a reverse-proxy page): the status is all there is
  }
  const retryAfter = response.headers.get("retry-after");
  return (
    `Proof server refused the request: ${response.status}${reason ? ` ${reason}` : ""}` +
    (error ? ` — ${error}` : "") +
    (retryAfter ? `; retry after ${retryAfter} s` : "")
  );
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
