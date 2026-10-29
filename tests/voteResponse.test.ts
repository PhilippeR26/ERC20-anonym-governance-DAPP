import { describe, it, expect } from "vitest";
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
});
