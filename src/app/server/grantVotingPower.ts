import { Contract, RpcError, type Abi, type RpcProvider } from "starknet";
import { GRANT_AMOUNT, TOKEN_ADDRESS } from "@/app/utils/constants";
import tokenAbi from "@/app/abi/token.json";
import { contractReason } from "./contractReason";
import type { Sponsor } from "./sponsor";

export type GrantInput = { address: string; nonce: string; expiry: number; signature: string[] };

// Mints the demo tokens to the visitor and delegates them to the visitor with the visitor's signed delegation,
// in one transaction sent (and paid) by the sponsor. Throws an Error whose message is meant for the visitor.
export async function grantVotingPower(
  input: GrantInput,
  deps: { provider: RpcProvider; sponsor: Sponsor },
): Promise<string> {
  const { provider, sponsor } = deps;

  // The token checks the delegation signature, and the governor the vote's, through the account contract itself.
  try {
    await provider.getClassHashAt(input.address);
  } catch (e) {
    if (e instanceof RpcError && e.isType("CONTRACT_NOT_FOUND")) {
      throw new Error("This account is not deployed yet: deploy it from your wallet (any transaction does it), then come back.");
    }
    throw e;
  }

  const token = new Contract({ abi: tokenAbi as Abi, address: TOKEN_ADDRESS, providerOrAccount: provider });
  if (BigInt(await token.balance_of(input.address)) !== 0n) {
    throw new Error("This address already has its voting power.");
  }

  const calls = [
    token.populate("mint", { recipient: input.address, amount: GRANT_AMOUNT }),
    token.populate("delegate_by_sig", {
      delegator: input.address,
      delegatee: input.address,
      nonce: input.nonce,
      expiry: input.expiry,
      signature: input.signature,
    }),
  ];
  try {
    const { transaction_hash } = await sponsor.execute(calls);
    return transaction_hash;
  } catch (e) {
    const reason = contractReason(e);
    throw reason === undefined ? e : new Error(`Grant refused: ${reason}`);
  }
}
