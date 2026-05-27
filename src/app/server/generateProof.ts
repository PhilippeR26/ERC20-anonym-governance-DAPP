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

  // Virtual transaction: the prover requires a max possible fee of zero, so all gas
  // *prices* and the tip must be 0. But the gas *amounts* must be non-zero, or the
  // account's __validate__ panics with 'Out of gas' before create_proof runs.
  const resourceBounds: ResourceBoundsBN = {
    l2_gas: { max_amount: 0x4000000n, max_price_per_unit: 0n },
    l1_gas: { max_amount: 0x100000n, max_price_per_unit: 0n },
    l1_data_gas: { max_amount: 0x10000n, max_price_per_unit: 0n },
  };

  const tx: INVOKE_TXN_V3 = await backend.getSignedTransaction(call, { resourceBounds, tip: 0n });
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
