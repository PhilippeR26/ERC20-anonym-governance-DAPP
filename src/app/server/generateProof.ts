"use server";

import { runVote } from "./castVote";

export async function generateProof(
  proposalId: string,
  support: number,
  voterAddress: string,
  signature: string[],
): Promise<{ transaction_hash: string }> {
  return { transaction_hash: await runVote({ proposalId, support, voterAddress, signature }, () => {}) };
}
