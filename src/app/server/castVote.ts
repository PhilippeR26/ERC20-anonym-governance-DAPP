import { Account, Contract, RpcProvider, CallData } from "starknet";
import type { Abi, ResourceBoundsBN } from "starknet";
import type { INVOKE_TXN_V3 } from "@starknet-io/types-js";
import { checkProofServerHealth, requestProof } from "./requestProof";
import {
  getBackendAccountConfig,
  getProofServerTarget,
  getRpcUrl,
  SUBMISSION_MARGIN_MS,
  VOTE_BUDGET_MS,
} from "./serverConfig";
import { checkVoteRequest } from "./voteGuard";
import { GOVERNOR_ADDRESS, REFERENCE_BLOCK_LAG } from "@/app/utils/constants";
import { NETWORK } from "@/app/utils/network";
import type { VoteInput, VoteProgressEvent } from "@/app/utils/voteEvents";
import governorAbi from "@/app/abi/governor.json";

type AnonVoteMessage = {
  proposal_id: string;
  nullifier: string;
  support: number;
  weight: string;
};

export async function runVote(
  input: VoteInput,
  emit: (e: VoteProgressEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  const startedAt = Date.now();
  const myProvider = new RpcProvider({ nodeUrl: getRpcUrl() });
  const backendAccount = getBackendAccountConfig();
  const backend = new Account({
    provider: myProvider,
    address: backendAccount.address,
    signer: backendAccount.privateKey,
  });
  const gov = new Contract({
    abi: governorAbi as Abi,
    address: GOVERNOR_ADDRESS,
    providerOrAccount: backend,
  });

  const call = gov.populate("create_proof", {
    proposal_id: input.proposalId,
    support: input.support,
    voter: input.voterAddress,
    private_input: { signature: input.signature },
  });

  // Free reads first: a vote the contract would refuse must reach neither the proof server (small daily quota) nor its health check.
  const refusal = await checkVoteRequest(myProvider, gov, input.proposalId, call);
  if (refusal) throw new Error(refusal);

  const target = getProofServerTarget();
  const healthProblem = await checkProofServerHealth(target, NETWORK.name);
  if (healthProblem) throw new Error(healthProblem);

  // Virtual transaction: the prover requires a max possible fee of zero, so all gas
  // *prices* and the tip must be 0. But the gas *amounts* must be non-zero, or the
  // account's __validate__ panics with 'Out of gas' before create_proof runs.
  // Amounts from 28.testGovernance2Proof.ts with 3× buffer (from Testnet fee estimate).
  const resourceBounds: ResourceBoundsBN = {
    l2_gas: { max_amount: BigInt("0x279fc0") * 3n, max_price_per_unit: 0n },
    l1_gas: { max_amount: BigInt("0xbd2a") * 3n, max_price_per_unit: 0n },
    l1_data_gas: { max_amount: BigInt("0xc0") * 3n, max_price_per_unit: 0n },
  };

  const referenceBlock = (await myProvider.getBlockNumber()) - REFERENCE_BLOCK_LAG;
  const nonce = await backend.getNonce(referenceBlock);
  const tx: INVOKE_TXN_V3 = await backend.getSignedTransaction(call, { resourceBounds, tip: 0n, nonce });
  console.log(`Proof reference block: ${referenceBlock} (head - ${REFERENCE_BLOCK_LAG})`);
  const result = await requestProof(referenceBlock, tx, {
    target,
    deadline: startedAt + VOTE_BUDGET_MS - SUBMISSION_MARGIN_MS,
    onProgress: emit,
    signal,
  });
  emit({ type: "proved" });

  if (!result.l2ToL1Messages[0])
    throw new Error("Proof server returned no L2→L1 message — cannot decode public vote message");
  const cd = new CallData(governorAbi as Abi);
  const publicMessage = cd.decodeParameters(
    "openzeppelin_governance::governor::extensions::governor_counting_anonymous::GovernorCountingAnonymousComponent::AnonVoteMessage",
    result.l2ToL1Messages[0].payload as string[],
  ) as AnonVoteMessage;

  const castCall = gov.populate("cast_anonymous_vote", { public_message: publicMessage });
  const { transaction_hash } = await backend.execute(castCall, {
    proof: result.proof,
    proofFacts: result.proofFacts,
  });
  return transaction_hash;
}
