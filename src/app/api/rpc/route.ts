import { ConfigError, getRpcUrl } from "@/app/server/serverConfig";
import { NETWORK } from "@/app/utils/network";

type RpcBody = { id?: unknown; method?: unknown; params?: { request?: { contract_address?: unknown } } };

// What the browser reads from the chain: the head and the chain id, the two contracts, and the wait for its own transactions.
const RELAYED_METHODS = new Set([
  "starknet_specVersion",
  "starknet_chainId",
  "starknet_blockNumber",
  "starknet_call",
  "starknet_getTransactionStatus",
  "starknet_getTransactionReceipt",
]);
const RELAYED_CONTRACTS = [NETWORK.governorAddress, NETWORK.tokenAddress].map((address) => BigInt(address));

function rpcError(id: unknown, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function isRelayedContract(address: unknown): boolean {
  try {
    return RELAYED_CONTRACTS.includes(BigInt(address as string));
  } catch {
    return false;
  }
}

// The relay is public and adds the Alchemy key to whatever it forwards: it only passes what the DApp itself asks for.
function refusal(body: RpcBody): string | undefined {
  if (typeof body.method !== "string" || !RELAYED_METHODS.has(body.method)) {
    return `Method ${String(body.method)} is not relayed by this DApp`;
  }
  if (body.method === "starknet_call" && !isRelayedContract(body.params?.request?.contract_address)) {
    return "starknet_call is only relayed for the governor and the token";
  }
  return undefined;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return rpcError(null, -32600, "Only single requests are relayed");
  }
  const rpc = body as RpcBody;

  const reason = refusal(rpc);
  if (reason) {
    console.warn(`RPC relay: ${reason}`);
    return rpcError(rpc.id, -32601, reason);
  }

  let rpcUrl: string;
  try {
    rpcUrl = getRpcUrl();
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    return rpcError(rpc.id, -32603, e.message);
  }
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return Response.json(data);
}
