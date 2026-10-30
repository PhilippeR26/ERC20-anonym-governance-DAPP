import { describe, it, expect, vi, afterEach } from "vitest";
import { postJson } from "../src/app/utils/postJson";

function answer(body: string, status: number, contentType = "application/json") {
  return new Response(body, { status, headers: { "Content-Type": contentType } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postJson", () => {
  it("resolves to the JSON answer", async () => {
    vi.stubGlobal("fetch", async () => answer(JSON.stringify({ ok: 1 }), 200));

    await expect(postJson("/api/x", {})).resolves.toEqual({ ok: 1 });
  });

  it("sends the body as JSON in a POST", async () => {
    let sent: { url: string; init: RequestInit } | undefined;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      sent = { url, init };
      return answer("{}", 200);
    });

    await postJson("/api/x", { a: 1 });

    expect(sent?.url).toBe("/api/x");
    expect(sent?.init.method).toBe("POST");
    expect(sent?.init.body).toBe('{"a":1}');
    expect(new Headers(sent?.init.headers).get("Content-Type")).toBe("application/json");
  });

  it("rejects with the error the server sent as data", async () => {
    vi.stubGlobal("fetch", async () => answer(JSON.stringify({ error: "The description is empty." }), 400));

    await expect(postJson("/api/x", {})).rejects.toMatchObject({ message: "The description is empty." });
  });

  it("rejects with the HTTP status when the answer is not JSON", async () => {
    vi.stubGlobal("fetch", async () => answer("<html>Bad Gateway</html>", 502, "text/html"));

    await expect(postJson("/api/x", {})).rejects.toMatchObject({ message: "Request failed: HTTP 502" });
  });

  it("rejects with the HTTP status when an error status carries no message", async () => {
    vi.stubGlobal("fetch", async () => answer("{}", 500));

    await expect(postJson("/api/x", {})).rejects.toMatchObject({ message: "Request failed: HTTP 500" });
  });
});
