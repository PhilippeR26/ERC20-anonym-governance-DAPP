import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../src/app/api/propose/route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/propose", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/propose", () => {
  beforeEach(() => {
    vi.stubEnv("ALCHEMY_API_KEY", "k");
    vi.stubEnv("SEPOLIA_BACKEND_ACCOUNT_ADDRESS", "0xa");
    vi.stubEnv("SEPOLIA_BACKEND_ACCOUNT_PRIVATE_KEY", "0xb");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("answers an empty description with the reason, as data", async () => {
    const res = await POST(post({ description: "   " }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "The description is empty." });
  });

  it("refuses a body without description", async () => {
    const res = await POST(post({}));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request" });
  });

  it("refuses a description that is not a text", async () => {
    const res = await POST(post({ description: 42 }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request" });
  });

  it("refuses a body that is not JSON", async () => {
    const res = await POST(post("not json"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request" });
  });
});
