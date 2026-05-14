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
  const response = await fetch(`${proofServerUrl}/prove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockNumber: currentBlock, tx }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let proofRes: ProveResult | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";

    for (const message of messages) {
      if (!message.trim()) continue;
      const eventMatch = message.match(/^event: (\w+)/);
      const dataMatch = message.match(/^data: (.+)$/m);
      if (!eventMatch || !dataMatch) continue;
      const event = eventMatch[1];
      const data = JSON.parse(dataMatch[1]);

      if (event === "log") console.log(`[proof-server][${data.stream}]`, data.line);
      if (event === "done") proofRes = data;
      if (event === "error") throw new Error(`Proof server error: ${data.message}`);
    }
  }

  if (!proofRes) throw new Error("Proof server returned no result");
  return proofRes;
}
