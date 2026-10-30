import { ConfigError, getRpcUrl } from "@/app/server/serverConfig";

export async function POST(request: Request) {
  const body = await request.json();
  let rpcUrl: string;
  try {
    rpcUrl = getRpcUrl();
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    return Response.json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32603, message: e.message } });
  }
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return Response.json(data);
}
