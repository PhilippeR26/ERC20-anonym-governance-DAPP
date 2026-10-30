import { describe, it, expect, afterEach } from "vitest";
import { useProposalStore } from "../src/app/store/proposalStore";

afterEach(() => {
  useProposalStore.getState().clearProposal();
});

const FINISHED = {
  proposalId: "1",
  description: "old",
  proposalTxHash: "0xold",
  voteTxHash: "0xvote",
  proposalState: "Succeeded",
  forVotes: "5",
  againstVotes: "1",
  abstainVotes: "2",
  quorumReached: true,
  voteSucceeded: true,
} as const;

describe("setProposal", () => {
  it("replaces a finished proposal without keeping anything read from the chain about it", () => {
    useProposalStore.setState(FINISHED);

    useProposalStore.getState().setProposal("2", "new", "0xnew");

    expect(useProposalStore.getState()).toMatchObject({
      proposalId: "2",
      description: "new",
      proposalTxHash: "0xnew",
      voteTxHash: null,
      proposalState: null,
      forVotes: "0",
      againstVotes: "0",
      abstainVotes: "0",
      quorumReached: false,
      voteSucceeded: false,
    });
  });
});

describe("setVoteTx", () => {
  it("records the hash of a vote on the current proposal", () => {
    useProposalStore.getState().setProposal("2", "new", "0xnew");

    useProposalStore.getState().setVoteTx("2", "0xvote");

    expect(useProposalStore.getState().voteTxHash).toBe("0xvote");
  });

  it("ignores a vote confirmed after its proposal was replaced or forgotten", () => {
    useProposalStore.getState().setProposal("2", "new", "0xnew");

    useProposalStore.getState().setVoteTx("1", "0xlate");

    expect(useProposalStore.getState().voteTxHash).toBeNull();
  });
});

describe("clearProposal", () => {
  it("forgets the proposal and both transaction hashes", () => {
    useProposalStore.setState(FINISHED);

    useProposalStore.getState().clearProposal();

    expect(useProposalStore.getState()).toMatchObject({
      proposalId: null,
      description: "",
      proposalTxHash: null,
      voteTxHash: null,
      proposalState: null,
    });
  });
});
