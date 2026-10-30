import { describe, it, expect } from "vitest";
import { RpcError, RpcProvider, type Call } from "starknet";
import { grantVotingPower } from "../src/app/server/grantVotingPower";
import { GRANT_AMOUNT, TOKEN_ADDRESS } from "../src/app/utils/constants";
import type { Sponsor } from "../src/app/server/sponsor";
import { fakeStarknetNode } from "./helpers/fakeStarknetNode";

const VISITOR = "0x1234";
const EXPIRY = 1_800_000_000;
const SIGNATURE = ["0x11", "0x22", "0x33", "0x44", "0x55"];
const INPUT = { address: VISITOR, nonce: "0x0", expiry: EXPIRY, signature: SIGNATURE };

const DEPLOYED = { result: "0x387309" };
const NOT_DEPLOYED = { error: { code: 20, message: "Contract not found" } };
const NO_TOKENS = { result: ["0x0", "0x0"] };
const SOME_TOKENS = { result: ["0x5", "0x0"] };

// The failed fee estimation of a transaction whose delegation signature the token refuses.
const estimationRefused = () =>
  new RpcError(
    {
      code: 41,
      message: "Transaction execution error",
      data: {
        transaction_index: 0,
        execution_error: {
          contract_address: TOKEN_ADDRESS,
          class_hash: "0x2",
          selector: "0x3",
          error: "0x566f7465733a20696e76616c6964207369676e6174757265 ('Votes: invalid signature')",
        },
      },
    } as never,
    "starknet_estimateFee",
    {},
  );

type RpcReply = Parameters<typeof fakeStarknetNode>[0][string];

function setup(options: { classHash?: RpcReply; balance?: RpcReply; executeError?: unknown } = {}) {
  const node = fakeStarknetNode(
    { balance_of: options.balance ?? NO_TOKENS },
    { starknet_getClassHashAt: options.classHash ?? DEPLOYED },
  );
  const provider = new RpcProvider({ nodeUrl: "http://node.test", baseFetch: node.fetch });
  const executed: Call[][] = [];
  const sponsor: Sponsor = {
    address: "0xabc",
    execute: async (calls) => {
      if (options.executeError) throw options.executeError;
      executed.push(calls);
      return { transaction_hash: "0xfeed" };
    },
    waitForTransaction: async () => ({}),
  };
  return { executed, grant: () => grantVotingPower(INPUT, { provider, sponsor }) };
}

const felts = (call: Call) => (call.calldata as string[]).map((felt) => BigInt(felt));

describe("grantVotingPower", () => {
  it("refuses an account that is not deployed, and sends nothing", async () => {
    const { executed, grant } = setup({ classHash: NOT_DEPLOYED });

    await expect(grant()).rejects.toThrow(
      "This account is not deployed yet: deploy it from your wallet (any transaction does it), then come back.",
    );
    expect(executed).toEqual([]);
  });

  it("refuses an address that already has tokens, and sends nothing", async () => {
    const { executed, grant } = setup({ balance: SOME_TOKENS });

    await expect(grant()).rejects.toThrow("This address already has its voting power.");
    expect(executed).toEqual([]);
  });

  it("sends the mint and the delegation by signature in one transaction", async () => {
    const { executed, grant } = setup();

    expect(await grant()).toBe("0xfeed");

    expect(executed).toHaveLength(1);
    const [mint, delegate] = executed[0];
    expect(BigInt(mint.contractAddress)).toBe(BigInt(TOKEN_ADDRESS));
    expect(mint.entrypoint).toBe("mint");
    expect(felts(mint)).toEqual([BigInt(VISITOR), GRANT_AMOUNT, 0n]);
    expect(BigInt(delegate.contractAddress)).toBe(BigInt(TOKEN_ADDRESS));
    expect(delegate.entrypoint).toBe("delegate_by_sig");
    expect(felts(delegate)).toEqual([
      BigInt(VISITOR),
      BigInt(VISITOR),
      0n,
      BigInt(EXPIRY),
      5n,
      ...SIGNATURE.map((felt) => BigInt(felt)),
    ]);
  });

  it("gives the reason of a refused estimation", async () => {
    const { grant } = setup({ executeError: estimationRefused() });

    await expect(grant()).rejects.toThrow("Grant refused: Votes: invalid signature");
  });

  it("lets a failure without a contract reason through, unchanged", async () => {
    const { grant } = setup({
      executeError: new Error("Account balance is smaller than the transaction's maximal fee"),
    });

    await expect(grant()).rejects.toMatchObject({
      message: "Account balance is smaller than the transaction's maximal fee",
    });
  });
});
