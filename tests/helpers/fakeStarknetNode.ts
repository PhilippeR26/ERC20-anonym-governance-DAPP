import { hash } from "starknet";

type RpcReply = { result: unknown } | { error: { code: number; message: string; data?: unknown } };

// starknet.js keeps the fetch it finds at import time, so a stubbed global fetch never reaches it:
// hand `fetch` to `new RpcProvider({ baseFetch })`, or to `config.set("fetch", …)` for code that builds its own provider.
// The node answers starknet_call by entry-point name, records those names in order, and refuses any other method.
export function fakeStarknetNode(entrypoints: Record<string, RpcReply>): { fetch: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const names = new Map(Object.keys(entrypoints).map((name) => [BigInt(hash.getSelectorFromName(name)), name]));

  const fakeFetch = async (_url: unknown, init?: RequestInit) => {
    const { id, method, params } = JSON.parse(init!.body as string);
    let reply: RpcReply;
    if (method === "starknet_specVersion") {
      reply = { result: "0.10.0" };
    } else if (method === "starknet_call") {
      const name = names.get(BigInt(params.request.entry_point_selector));
      calls.push(name ?? "unknown entry point");
      reply = name ? entrypoints[name] : { error: { code: 21, message: "Invalid message selector" } };
    } else {
      reply = { error: { code: -32601, message: `Method not found: ${method}` } };
    }
    return Response.json({ jsonrpc: "2.0", id, ...reply });
  };

  return { fetch: fakeFetch, calls };
}
