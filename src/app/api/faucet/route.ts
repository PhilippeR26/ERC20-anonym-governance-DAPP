import { errorMessage } from "@/app/server/errorMessage";
import { grantVotingPower, type GrantInput } from "@/app/server/grantVotingPower";
import { getSponsor } from "@/app/server/sponsor";

function isGrantInput(body: unknown): body is GrantInput {
  const b = body as Partial<GrantInput> | null | undefined;
  return (
    typeof b === "object" &&
    b !== null &&
    typeof b.address === "string" &&
    typeof b.nonce === "string" &&
    typeof b.expiry === "number" &&
    Number.isInteger(b.expiry) &&
    Array.isArray(b.signature) &&
    b.signature.length > 0 &&
    b.signature.every((felt) => typeof felt === "string")
  );
}

// Public route, like /api/vote: errors travel as data (a thrown error reaches the browser as an opaque HTTP 500).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  if (!isGrantInput(body)) return Response.json({ error: "Invalid request" }, { status: 400 });

  try {
    const { provider, sponsor } = getSponsor();
    return Response.json({ transactionHash: await grantVotingPower(body, { provider, sponsor }) });
  } catch (e) {
    console.error("Grant failed:", e);
    return Response.json({ error: errorMessage(e) }, { status: 400 });
  }
}
