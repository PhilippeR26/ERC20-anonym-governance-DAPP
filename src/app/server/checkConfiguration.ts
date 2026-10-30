"use server";

import { checkProofServerHealth } from "./requestProof";
import { ConfigError, getProofServerTarget, listConfigProblems } from "./serverConfig";
import { NETWORK } from "@/app/utils/network";

// Returns the problems as data: Next.js hides the message of an error thrown by a Server Action in production.
export async function checkConfiguration(): Promise<string[]> {
  const problems = listConfigProblems();
  let target;
  try {
    target = getProofServerTarget();
  } catch (e) {
    if (e instanceof ConfigError) return problems;
    throw e;
  }
  const healthProblem = await checkProofServerHealth(target, NETWORK.name);
  return healthProblem ? [...problems, healthProblem] : problems;
}
