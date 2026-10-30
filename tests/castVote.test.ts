import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { config } from "starknet";
import { runVote } from "../src/app/server/castVote";
import { fakeStarknetNode } from "./helpers/fakeStarknetNode";

const INPUT = { proposalId: "0x1", support: 1, voterAddress: "0x2", signature: ["0x3", "0x4"] };

// ProposalState felts: 1 Active, 4 Succeeded.
const ACTIVE = { result: ["0x1"] };
const SUCCEEDED = { result: ["0x4"] };
const ACCEPTED = { result: [] };

const panic = (text: string) => ({
  error: {
    code: 40,
    message: "Contract error",
    data: { revert_error: { error: `0x${Buffer.from(text).toString("hex")} ('${text}')` } },
  },
});

// The proof server is reached with the global fetch (the node is not: starknet.js keeps its own, see fakeStarknetNode).
function stubProofServer(health: string): string[] {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    return new Response(health);
  });
  return calls;
}

describe("runVote", () => {
  beforeEach(() => {
    vi.stubEnv("ALCHEMY_API_KEY", "k");
    vi.stubEnv("SEPOLIA_BACKEND_ACCOUNT_ADDRESS", "0xa");
    vi.stubEnv("SEPOLIA_BACKEND_ACCOUNT_PRIVATE_KEY", "0xb");
    vi.stubEnv("PROOF_SERVER_URL", "https://proof.example");
    vi.stubEnv("PROOF_SERVER_API_KEY", "s");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    config.delete("fetch");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refuses a vote the contract would reject, without contacting the proof server", async () => {
    config.set("fetch", fakeStarknetNode({ state: ACTIVE, create_proof: panic("Nullifier already used") }).fetch);
    const proofServerCalls = stubProofServer('{"ok":true,"network":"sepolia"}');

    await expect(runVote(INPUT, () => {})).rejects.toThrow("Vote refused: Nullifier already used");
    expect(proofServerCalls).toEqual([]);
  });

  it("refuses a proposal that is not Active, without contacting the proof server", async () => {
    config.set("fetch", fakeStarknetNode({ state: SUCCEEDED, create_proof: ACCEPTED }).fetch);
    const proofServerCalls = stubProofServer('{"ok":true,"network":"sepolia"}');

    await expect(runVote(INPUT, () => {})).rejects.toThrow("Vote refused: the proposal is Succeeded, not Active");
    expect(proofServerCalls).toEqual([]);
  });

  it("stops before signing when the proof server is on another network", async () => {
    config.set("fetch", fakeStarknetNode({ state: ACTIVE, create_proof: ACCEPTED }).fetch);
    const proofServerCalls = stubProofServer('{"ok":true,"network":"mainnet"}');

    await expect(runVote(INPUT, () => {})).rejects.toThrow(
      "Proof server proves mainnet, but this DApp runs on sepolia",
    );
    expect(proofServerCalls).toEqual(["https://proof.example/sepolia/health"]);
  });
});
