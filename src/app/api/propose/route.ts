import { createProposal } from "@/app/server/createProposal";
import { errorMessage } from "@/app/server/errorMessage";
import { getSponsor } from "@/app/server/sponsor";

// Public route, like /api/vote: errors travel as data (a thrown error reaches the browser as an opaque HTTP 500).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const description = (body as { description?: unknown } | null | undefined)?.description;
  if (typeof description !== "string") return Response.json({ error: "Invalid request" }, { status: 400 });

  try {
    const { provider, sponsor } = getSponsor();
    return Response.json(await createProposal(description, { provider, sponsor }));
  } catch (e) {
    console.error("Proposal failed:", e);
    return Response.json({ error: errorMessage(e) }, { status: 400 });
  }
}
