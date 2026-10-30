import { hash } from "starknet";

type RpcReply = { result: unknown } | { error: { code: number; message: string; data?: unknown } };

// starknet.js keeps the fetch it finds at import time, so a stubbed global fetch never reaches it:
// hand `fetch` to `new RpcProvider({ baseFetch })`, or to `config.set("fetch", …)` for code that builds its own provider.
// The node answers starknet_call by entry-point name and records those names in order. The other methods it answers are
// listed in `methods` (by method name); it refuses the rest.
export function fakeStarknetNode(
  entrypoints: Record<string, RpcReply>,
  methods: Record<string, RpcReply> = {},
): { fetch: typeof fetch; calls: string[] } {
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
      reply = methods[method] ?? { error: { code: -32601, message: `Method not found: ${method}` } };
    }
    return Response.json({ jsonrpc: "2.0", id, ...reply });
  };

  return { fetch: fakeFetch, calls };
}
