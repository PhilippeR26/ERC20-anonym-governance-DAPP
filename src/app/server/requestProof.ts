import type { INVOKE_TXN_V3 } from "@starknet-io/types-js";
import type { BigNumberish } from "starknet";

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

const LOCAL_MAX_WAIT_MS = 10 * 60_000;
const GATEWAY_TIMEOUT_MS = 120_000;

// PROVER selects the proof server: "local" (default) or "gateway".
export async function requestProof(
  currentBlock: number,
  tx: INVOKE_TXN_V3,
): Promise<ProveResult> {
  const prover = process.env.PROVER ?? "local";
  if (prover === "local") return requestLocalProof(currentBlock, tx);
  if (prover === "gateway") return requestGatewayProof(currentBlock, tx);
  throw new Error(`Unknown PROVER "${prover}" (expected "local" or "gateway")`);
}

// Local snip36 proof server (secure-voty/proofServer): answers with a Server-Sent Events stream.
async function requestLocalProof(currentBlock: number, tx: INVOKE_TXN_V3): Promise<ProveResult> {
  const proofServerUrl = process.env.PROOF_SERVER_URL ?? "http://localhost:3030";
  const startedAt = Date.now();
  const response = await fetch(`${proofServerUrl}/prove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockNumber: currentBlock, tx }),
    signal: AbortSignal.timeout(LOCAL_MAX_WAIT_MS),
  });
  if (!response.ok) throw new Error(`Local proof server HTTP ${response.status}: ${await response.text()}`);

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
      if (event === "log") console.log(`[proof-server][${payload.stream}]`, payload.line);
      if (event === "done") proofRes = payload;
      if (event === "error") throw new Error(`Local proof server error: ${payload.message}`);
    }
  }

  console.log(`Local proof server: ${proofRes ? "done" : "no result"} after ${seconds(Date.now() - startedAt)}`);
  if (!proofRes) throw new Error("Local proof server returned no result");
  return {
    proof: proofRes.proof,
    proofFacts: proofRes.proofFacts,
    l2ToL1Messages: proofRes.l2ToL1Messages ?? [],
  };
}

// Remote SNIP-36 prover gateway (Starknet Foundation): JSON-RPC starknet_proveTransaction.
async function requestGatewayProof(currentBlock: number, tx: INVOKE_TXN_V3): Promise<ProveResult> {
  const gatewayUrl = process.env.PROOF_GATEWAY_URL;
  if (!gatewayUrl) throw new Error("PROOF_GATEWAY_URL is not set");
  const apiKey = process.env.PROOF_GATEWAY_API_KEY;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  const startedAt = Date.now();
  const response = await fetch(`${gatewayUrl}/v1/prove`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      payload: {
        jsonrpc: "2.0",
        id: 1,
        method: "starknet_proveTransaction",
        params: { block_id: { block_number: currentBlock }, transaction: tx },
      },
    }),
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  });
  console.log(`Proof gateway: HTTP ${response.status} after ${seconds(Date.now() - startedAt)}`);
  if (!response.ok) throw new Error(`Proof gateway HTTP ${response.status}: ${await response.text()}`);

  const data = await response.json();
  const rpc = data.result;
  if (!rpc) throw new Error(`Proof gateway returned no result: ${JSON.stringify(data)}`);
  if (rpc.error) throw new Error(`Proof gateway RPC error: ${JSON.stringify(rpc.error)}`);
  if (!rpc.result) throw new Error(`Proof gateway RPC: missing result field: ${JSON.stringify(rpc)}`);
  const r = rpc.result;
  return {
    proof: r.proof,
    proofFacts: r.proofFacts ?? r.proof_facts ?? [],
    l2ToL1Messages: r.l2ToL1Messages ?? r.l2_to_l1_messages ?? [],
  };
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
