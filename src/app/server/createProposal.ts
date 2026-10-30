import { Contract, type Abi, type RpcProvider } from "starknet";
import { DESCRIPTION_MAX_LENGTH, GOVERNOR_ADDRESS, TOKEN_ADDRESS } from "@/app/utils/constants";
import { hashProposal } from "@/app/utils/hashProposal";
import governorAbi from "@/app/abi/governor.json";
import tokenAbi from "@/app/abi/token.json";
import { contractReason } from "./contractReason";
import type { Sponsor } from "./sponsor";

export type CreatedProposal = { proposalId: string; description: string; transactionHash: string };

// A proposal id is the hash of its description: without a mark, two visitors typing the same text would collide.
export function demoDescription(text: string, now: Date): string {
  const stamp = now.toISOString().slice(0, 19).replace("T", " ");
  return `${text.trim()}\n\n[demo ${stamp} UTC]`;
}

// The proposal is sent by the sponsor, so the visitor signs nothing. Throws an Error whose message is meant for the visitor.
export async function createProposal(
  text: string,
  deps: { provider: RpcProvider; sponsor: Sponsor; now?: () => Date },
): Promise<CreatedProposal> {
  const { provider, sponsor, now = () => new Date() } = deps;

  const trimmed = text.trim();
  if (trimmed === "") throw new Error("The description is empty.");
  if (trimmed.length > DESCRIPTION_MAX_LENGTH) {
    throw new Error(`The description is longer than ${DESCRIPTION_MAX_LENGTH} characters.`);
  }
  const description = demoDescription(trimmed, now());

  const gov = new Contract({ abi: governorAbi as Abi, address: GOVERNOR_ADDRESS, providerOrAccount: provider });
  const token = new Contract({ abi: tokenAbi as Abi, address: TOKEN_ADDRESS, providerOrAccount: provider });

  try {
    // The governor reads the proposer's votes one block before the proposal, so the sponsor must hold the threshold in
    // voting power. An accepted transaction is in a closed block: the proposal then lands in a later one.
    const threshold = BigInt(await gov.proposal_threshold());
    if (BigInt(await token.get_votes(sponsor.address)) < threshold) {
      const delegation = await sponsor.execute([token.populate("delegate", { delegatee: sponsor.address })]);
      await sponsor.waitForTransaction(delegation.transaction_hash);
    }

    const { transaction_hash } = await sponsor.execute([gov.populate("propose", { calls: [], description })]);
    return { proposalId: hashProposal(description), description, transactionHash: transaction_hash };
  } catch (e) {
    const reason = contractReason(e);
    throw reason === undefined ? e : new Error(`Proposal refused: ${reason}`);
  }
}
