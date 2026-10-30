import { runVote } from "@/app/server/castVote";
import { voteResponse } from "@/app/server/voteResponse";
import type { VoteInput } from "@/app/utils/voteEvents";

// Route segment config must be a literal: keep it equal to VOTE_BUDGET_MS / 1000 (serverConfig.ts).
export const maxDuration = 300;

export async function POST(request: Request) {
  const input = (await request.json()) as VoteInput;
  return voteResponse((emit, signal) => runVote(input, emit, signal));
}
