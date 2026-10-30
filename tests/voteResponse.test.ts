import { describe, it, expect, vi } from "vitest";
import { voteResponse } from "../src/app/server/voteResponse";

async function lines(res: Response): Promise<unknown[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

describe("voteResponse", () => {
  it("streams progress then submitted", async () => {
    const res = voteResponse(async (emit) => {
      emit({ type: "started" });
      return "0xabc";
    });

    expect(res.headers.get("content-type")).toBe("application/x-ndjson");
    expect(await lines(res)).toEqual([{ type: "started" }, { type: "submitted", transactionHash: "0xabc" }]);
  });

  it("ends with an error event when the run throws", async () => {
    const res = voteResponse(async () => {
      throw new Error("SEPOLIA_BACKEND_ACCOUNT_ADDRESS is not set (required for network sepolia)");
    });

    expect(await lines(res)).toEqual([
      { type: "error", message: "SEPOLIA_BACKEND_ACCOUNT_ADDRESS is not set (required for network sepolia)" },
    ]);
  });

  it("aborts the run's signal when the client cancels the stream, and later events do not throw", async () => {
    let runSignal: AbortSignal | undefined;
    let afterCancel: unknown = "not reached";
    const res = voteResponse(async (emit, signal) => {
      runSignal = signal;
      emit({ type: "started" });
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
      try {
        emit({ type: "proved" });
        afterCancel = "no error";
      } catch (e) {
        afterCancel = e;
      }
      return "0xabc";
    });
    const reader = res.body!.getReader();
    await reader.read();

    await reader.cancel();

    await vi.waitFor(() => expect(afterCancel).not.toBe("not reached"));
    expect(runSignal?.aborted).toBe(true);
    expect(afterCancel).toBe("no error");
  });

  it("keeps only the base error of a starknet.js RpcError, not the request parameters it embeds", async () => {
    const rpcError = Object.assign(
      new Error(`RPC: starknet_addInvokeTransaction with params ${"A".repeat(5000)}\n\n 59: duplicate: "same hash"`),
      { baseError: { code: 59, message: "A transaction with the same hash already exists", data: "same hash" } },
    );

    const res = voteResponse(async () => {
      throw rpcError;
    });

    expect(await lines(res)).toEqual([
      { type: "error", message: "59: A transaction with the same hash already exists: same hash" },
    ]);
  });

  it("truncates a very long error message", async () => {
    const res = voteResponse(async () => {
      throw new Error("x".repeat(5000));
    });

    const [event] = (await lines(res)) as { type: string; message: string }[];

    expect(event.message).toHaveLength(601);
    expect(event.message.endsWith("…")).toBe(true);
  });
});
