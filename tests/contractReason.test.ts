import { describe, it, expect } from "vitest";
import { RpcError } from "starknet";
import { contractReason } from "../src/app/server/contractReason";

const rpcError = (code: number, message: string, data: unknown) =>
  new RpcError({ code, message, data } as never, "starknet_estimateFee", {});

describe("contractReason", () => {
  it("gives the innermost reason of a nested contract error (code 40)", () => {
    const e = rpcError(40, "Contract error", {
      revert_error: {
        contract_address: "0x1",
        class_hash: "0x2",
        selector: "0x3",
        error: {
          contract_address: "0x4",
          class_hash: "0x5",
          selector: "0x6",
          error: "0x61 ('argent/invalid-signature')",
        },
      },
    });

    expect(contractReason(e)).toBe("argent/invalid-signature");
  });

  it("gives the reason of a failed fee estimation (code 41)", () => {
    const e = rpcError(41, "Transaction execution error", {
      transaction_index: 0,
      execution_error: {
        contract_address: "0x1",
        class_hash: "0x2",
        selector: "0x3",
        error: "0x566f7465733a20696e76616c6964207369676e6174757265 ('Votes: invalid signature')",
      },
    });

    expect(contractReason(e)).toBe("Votes: invalid signature");
  });

  it("is undefined when a contract error has no readable reason", () => {
    const e = rpcError(40, "Contract error", { revert_error: "Requested contract address 0x2 is not deployed" });

    expect(contractReason(e)).toBeUndefined();
  });

  it("is undefined for an RPC error of another type, even with a quoted text", () => {
    const e = rpcError(-32603, "Internal error", "see ('this')");

    expect(contractReason(e)).toBeUndefined();
  });

  it("is undefined for an ordinary error", () => {
    expect(contractReason(new Error("fetch failed"))).toBeUndefined();
  });
});
