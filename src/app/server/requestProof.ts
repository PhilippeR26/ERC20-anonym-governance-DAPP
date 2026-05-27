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
  l2ToL1Messages?: ProofMessage[];
};

export async function requestProof(
  currentBlock: number,
  tx: INVOKE_TXN_V3,
): Promise<ProveResult> {
  const proofServerUrl = process.env.PROOF_SERVER_URL ?? "http://localhost:3030";
  const apiKey = process.env.PROOF_SERVER_API_KEY;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  const body = JSON.stringify({
    payload: {
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_proveTransaction",
      params: {
        block_id: { block_number: currentBlock },
        transaction: tx,
      },
    },
  });

  const response = await fetch(`${proofServerUrl}/v1/prove`, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Proof server HTTP ${response.status}: ${text}`);
  }

  const data = await response.json();
  const rpc = data.result;
  if (!rpc) throw new Error(`Proof server returned no result: ${JSON.stringify(data)}`);
  if (rpc.error) throw new Error(`Proof server RPC error: ${JSON.stringify(rpc.error)}`);
  if (!rpc.result) throw new Error(`Proof server RPC: missing result field: ${JSON.stringify(rpc)}`);
  // The prover returns snake_case keys; normalize to the camelCase callers expect.
  const r = rpc.result;
  return {
    proof: r.proof,
    proofFacts: r.proofFacts ?? r.proof_facts ?? [],
    l2ToL1Messages: r.l2ToL1Messages ?? r.l2_to_l1_messages,
  } as ProveResult;
}
