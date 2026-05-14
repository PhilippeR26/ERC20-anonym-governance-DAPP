// TEMPORARY — remove once voting flow is validated end-to-end
// Usage: GET /api/test/delegate?target=0x<voter_address>
// Delegates the backend account's tokens to the given address.

import { Account, Contract, RpcProvider } from "starknetFork";
import type { Abi } from "starknetFork";
import { TOKEN_ADDRESS } from "@/app/utils/constants";
import tokenAbi from "@/app/abi/token.json";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("target");
  if (!target) {
    return Response.json({ error: "Missing ?target=0x..." }, { status: 400 });
  }

  const provider = new RpcProvider({ nodeUrl: process.env.RPC_URL! });
  const backend = new Account({
    provider,
    address: process.env.BACKEND_ACCOUNT_ADDRESS!,
    signer: process.env.BACKEND_ACCOUNT_PRIVATE_KEY!,
  });
  const token = new Contract({
    abi: tokenAbi as Abi,
    address: TOKEN_ADDRESS,
    providerOrAccount: backend,
  });

  const call = token.populate("delegate", { delegatee: target });
  const { transaction_hash } = await backend.execute(call);
  await provider.waitForTransaction(transaction_hash);

  return Response.json({ transaction_hash, delegated_to: target });
}
