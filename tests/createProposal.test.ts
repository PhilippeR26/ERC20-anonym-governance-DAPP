import { describe, it, expect } from "vitest";
import { RpcError, RpcProvider, type Call } from "starknet";
import { createProposal, demoDescription } from "../src/app/server/createProposal";
import { GOVERNOR_ADDRESS, TOKEN_ADDRESS } from "../src/app/utils/constants";
import { hashProposal } from "../src/app/utils/hashProposal";
import type { Sponsor } from "../src/app/server/sponsor";
import { fakeStarknetNode } from "./helpers/fakeStarknetNode";

const SPONSOR = "0xabc";
const NOW = () => new Date("2026-10-30T18:00:00Z");
const MARK = "[demo 2026-10-30 18:00:00 UTC]";

type RpcReply = Parameters<typeof fakeStarknetNode>[0][string];
const hex = (n: bigint) => `0x${n.toString(16)}`;
const u256 = (n: bigint): RpcReply => ({ result: [hex(n & (2n ** 128n - 1n)), hex(n >> 128n)] });
const THRESHOLD = u256(10n ** 18n);
const MANY_VOTES = u256(1_000_000n * 10n ** 18n);
const NO_VOTES = u256(0n);

// The failed fee estimation of a proposal the governor refuses.
const proposalRefused = () =>
  new RpcError(
    {
      code: 41,
      message: "Transaction execution error",
      data: {
        transaction_index: 0,
        execution_error: {
          contract_address: GOVERNOR_ADDRESS,
          class_hash: "0x2",
          selector: "0x3",
          error: "0x496e73756666696369656e7420766f746573 ('Insufficient votes')",
        },
      },
    } as never,
    "starknet_estimateFee",
    {},
  );

function setup(options: { votes?: RpcReply; proposeError?: unknown } = {}) {
  const node = fakeStarknetNode({ proposal_threshold: THRESHOLD, get_votes: options.votes ?? MANY_VOTES });
  const provider = new RpcProvider({ nodeUrl: "http://node.test", baseFetch: node.fetch });
  const executed: Call[][] = [];
  const log: string[] = [];
  const sponsor: Sponsor = {
    address: SPONSOR,
    execute: async (calls) => {
      const isDelegation = calls[0].entrypoint === "delegate";
      if (options.proposeError && !isDelegation) throw options.proposeError;
      executed.push(calls);
      log.push(`execute ${calls[0].entrypoint}`);
      return { transaction_hash: isDelegation ? "0xde1e" : "0xfeed" };
    },
    waitForTransaction: async (hash) => {
      log.push(`wait ${hash}`);
      return {};
    },
  };
  return { executed, log, create: (text: string) => createProposal(text, { provider, sponsor, now: NOW }) };
}

const felts = (call: Call) => (call.calldata as string[]).map((felt) => BigInt(felt));

describe("demoDescription", () => {
  it("adds a UTC time mark to the trimmed text", () => {
    expect(demoDescription("  Hello ", NOW())).toBe(`Hello\n\n${MARK}`);
  });
});

describe("createProposal", () => {
  it("refuses an empty description", async () => {
    const { create } = setup();

    await expect(create("   ")).rejects.toThrow("The description is empty.");
  });

  it("refuses a description longer than 200 characters", async () => {
    const { create } = setup();

    await expect(create("a".repeat(201))).rejects.toThrow("The description is longer than 200 characters.");
  });

  it("accepts a description of exactly 200 characters", async () => {
    const { create } = setup();

    await expect(create("a".repeat(200))).resolves.toMatchObject({ transactionHash: "0xfeed" });
  });

  it("proposes from the sponsor when it has enough votes", async () => {
    const { executed, create } = setup();

    const created = await create("Hello");

    const description = `Hello\n\n${MARK}`;
    expect(created).toEqual({ proposalId: hashProposal(description), description, transactionHash: "0xfeed" });
    expect(executed).toHaveLength(1);
    const [propose] = executed[0];
    expect(BigInt(propose.contractAddress)).toBe(BigInt(GOVERNOR_ADDRESS));
    expect(propose.entrypoint).toBe("propose");
    expect(felts(propose)[0]).toBe(0n); // no call to execute
  });

  it("makes the sponsor delegate to itself first when it lacks the votes, and waits for that", async () => {
    const { executed, log, create } = setup({ votes: NO_VOTES });

    await create("Hello");

    expect(log).toEqual(["execute delegate", "wait 0xde1e", "execute propose"]);
    const [delegate] = executed[0];
    expect(BigInt(delegate.contractAddress)).toBe(BigInt(TOKEN_ADDRESS));
    expect(felts(delegate)).toEqual([BigInt(SPONSOR)]);
  });

  it("gives the reason of a refused proposal", async () => {
    const { create } = setup({ proposeError: proposalRefused() });

    await expect(create("Hello")).rejects.toThrow("Proposal refused: Insufficient votes");
  });

  it("lets a failure without a contract reason through, unchanged", async () => {
    const { create } = setup({
      proposeError: new Error("Account balance is smaller than the transaction's maximal fee"),
    });

    await expect(create("Hello")).rejects.toMatchObject({
      message: "Account balance is smaller than the transaction's maximal fee",
    });
  });
});
