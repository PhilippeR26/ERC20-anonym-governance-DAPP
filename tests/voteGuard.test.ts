import { describe, it, expect } from "vitest";
import { Contract, RpcProvider, type Abi } from "starknet";
import governorAbi from "../src/app/abi/governor.json";
import { checkVoteRequest } from "../src/app/server/voteGuard";
import { fakeStarknetNode } from "./helpers/fakeStarknetNode";

const GOVERNOR = "0x64834acb5abf44bc0173291722679c41bad701517033bb6c64b0bb9a2342a89";
const PROPOSAL = "0x1234";

// ProposalState felts: 0 Pending, 1 Active, 2 Canceled, 3 Defeated, 4 Succeeded, 5 Queued, 6 Executed.
const ACTIVE = { result: ["0x1"] };
const SUCCEEDED = { result: ["0x4"] };
const ACCEPTED = { result: [] };

// How a node reports a contract that panics: code 40, then the reason as "<hex felt> ('<text>')".
// Shape taken from the answer of a Sepolia node to create_proof with a bad signature.
const panic = (text: string) => ({
  error: {
    code: 40,
    message: "Contract error",
    data: {
      revert_error: {
        class_hash: "0x387309",
        contract_address: GOVERNOR,
        error: `0x${Buffer.from(text).toString("hex")} ('${text}')`,
        selector: "0x1ebfe9",
      },
    },
  },
});

function setup(replies: Parameters<typeof fakeStarknetNode>[0]) {
  const node = fakeStarknetNode(replies);
  const provider = new RpcProvider({ nodeUrl: "http://node.test", baseFetch: node.fetch });
  const gov = new Contract({ abi: governorAbi as Abi, address: GOVERNOR, providerOrAccount: provider });
  const createProof = gov.populate("create_proof", {
    proposal_id: PROPOSAL,
    support: 1,
    voter: "0x2",
    private_input: { signature: ["0x3", "0x4"] },
  });
  return { node, check: () => checkVoteRequest(provider, gov, PROPOSAL, createProof) };
}

describe("checkVoteRequest", () => {
  it("accepts an Active proposal whose create_proof runs", async () => {
    const { node, check } = setup({ state: ACTIVE, create_proof: ACCEPTED });

    expect(await check()).toBeNull();
    expect(node.calls).toEqual(["state", "create_proof"]);
  });

  it("refuses a proposal that is not Active, without running create_proof", async () => {
    const { node, check } = setup({ state: SUCCEEDED, create_proof: ACCEPTED });

    expect(await check()).toBe("Vote refused: the proposal is Succeeded, not Active");
    expect(node.calls).toEqual(["state"]);
  });

  it("gives the reason the contract refuses create_proof for", async () => {
    const { check } = setup({ state: ACTIVE, create_proof: panic("Nullifier already used") });

    expect(await check()).toBe("Vote refused: Nullifier already used");
  });

  it("gives the reason of an unknown proposal", async () => {
    const { node, check } = setup({ state: panic("Nonexistent proposal"), create_proof: ACCEPTED });

    expect(await check()).toBe("Vote refused: Nonexistent proposal");
    expect(node.calls).toEqual(["state"]);
  });

  it("gives the reason of the innermost contract when the voter's account refuses", async () => {
    const { check } = setup({
      state: ACTIVE,
      create_proof: {
        error: {
          code: 40,
          message: "Contract error",
          data: {
            revert_error: {
              contract_address: GOVERNOR,
              class_hash: "0x1",
              selector: "0x2",
              error: {
                contract_address: "0x2",
                class_hash: "0x3",
                selector: "0x4",
                error: "0x61 ('argent/invalid-signature')",
              },
            },
          },
        },
      },
    });

    expect(await check()).toBe("Vote refused: argent/invalid-signature");
  });

  it("lets an error that is not a contract refusal through", async () => {
    const { check } = setup({
      state: { error: { code: -32603, message: "Internal error" } },
      create_proof: ACCEPTED,
    });

    await expect(check()).rejects.toThrow("Internal error");
  });

  it("lets a contract error without a readable reason through", async () => {
    const { check } = setup({
      state: ACTIVE,
      create_proof: {
        error: {
          code: 40,
          message: "Contract error",
          data: { revert_error: "Requested contract address 0x2 is not deployed" },
        },
      },
    });

    await expect(check()).rejects.toThrow("Requested contract address 0x2 is not deployed");
  });
});
