const MAX_ERROR_LENGTH = 600;

// The message of a starknet.js RpcError embeds every request parameter (a whole proof, a signed transaction), with the actual
// reason at the very end: keep only the base error, and bound anything else.
export function errorMessage(e: unknown): string {
  const base = (e as { baseError?: { code?: number; message?: string; data?: unknown } } | undefined)?.baseError;
  let text: string;
  if (base?.message !== undefined) {
    const data = base.data === undefined ? "" : `: ${typeof base.data === "string" ? base.data : JSON.stringify(base.data)}`;
    text = `${base.code}: ${base.message}${data}`;
  } else {
    text = e instanceof Error ? e.message : String(e);
  }
  return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH)}…` : text;
}
