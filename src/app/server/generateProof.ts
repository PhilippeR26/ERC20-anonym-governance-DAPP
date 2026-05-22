"use server";

import { Account, Contract, RpcProvider, CallData } from "starknetFork";
import type { Abi, ResourceBoundsBN, UniversalDetails } from "starknetFork";
import type { INVOKE_TXN_V3 } from "@starknet-io/types-js";
import { requestProof } from "./requestProof";
import { GOVERNOR_ADDRESS } from "@/app/utils/constants";
import governorAbi from "@/app/abi/governor.json";

type AnonVoteMessage = {
  proposal_id: string;
  nullifier: string;
  support: number;
  weight: string;
};

export async function generateProof(
  proposalId: string,
  support: number,
  voterAddress: string,
  signature: string[],
): Promise<{ transaction_hash: string }> {
  const myProvider = new RpcProvider({ nodeUrl: process.env.RPC_URL! });
  const backend = new Account({
    provider: myProvider,
    address: process.env.BACKEND_ACCOUNT_ADDRESS!,
    signer: process.env.BACKEND_ACCOUNT_PRIVATE_KEY!,
  });
  const gov = new Contract({
    abi: governorAbi as Abi,
    address: GOVERNOR_ADDRESS,
    providerOrAccount: backend,
  });

  const call = gov.populate("create_proof", {
    proposal_id: proposalId,
    support,
    voter: voterAddress,
    private_input: { signature },
  });

  // External proof server requires all resource bounds at zero for virtual transactions.
  const resourceBounds: ResourceBoundsBN = {
    l2_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
  };

  const tx: INVOKE_TXN_V3 = await backend.getSignedTransaction(call, { resourceBounds });
  const currentBlock = await myProvider.getBlockNumber();
  const result = await requestProof(currentBlock, tx);

  const cd = new CallData(governorAbi as Abi);
  const publicMessage = cd.decodeParameters(
    "openzeppelin_governance::governor::extensions::governor_counting_anonymous::GovernorCountingAnonymousComponent::AnonVoteMessage",
    result.l2ToL1Messages![0].payload as string[],
  ) as AnonVoteMessage;

  const castCall = gov.populate("cast_anonymous_vote", { public_message: publicMessage });
  const { transaction_hash } = await backend.execute(castCall, {
    proof: result.proof,
    proofFacts: result.proofFacts,
  } as UniversalDetails);
  return { transaction_hash };
}
