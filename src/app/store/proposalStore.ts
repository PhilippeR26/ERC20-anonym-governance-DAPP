"use client";

import { create } from "zustand";
import { Contract, type Abi, type CairoCustomEnum } from "starknet";
import { provider, GOVERNOR_ADDRESS } from "@/app/utils/constants";
import governorAbi from "@/app/abi/governor.json";

export type ProposalState =
  | "Pending"
  | "Active"
  | "Canceled"
  | "Defeated"
  | "Succeeded"
  | "Queued"
  | "Executed"
  | null;

const CLOSED_STATES: ProposalState[] = ["Canceled", "Defeated", "Succeeded", "Queued", "Executed"];

export const isProposalClosed = (state: ProposalState) => CLOSED_STATES.includes(state);

interface ProposalStoreState {
  proposalId: string | null;
  description: string;
  proposalTxHash: string | null;
  voteTxHash: string | null;

  proposalState: ProposalState;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  quorumReached: boolean;
  voteSucceeded: boolean;

  setProposal: (id: string, description: string, txHash?: string) => void;
  setVoteTx: (proposalId: string, hash: string) => void;
  clearProposal: () => void;
  refreshFromChain: () => Promise<void>;
}

// Not persisted: the demo journey lives in memory for one wallet connection, so nothing of a finished journey can show
// again after a reconnection or a reload.
export const useProposalStore = create<ProposalStoreState>()((set, get) => ({
  proposalId: null,
  description: "",
  proposalTxHash: null,
  voteTxHash: null,
  proposalState: null,
  forVotes: "0",
  againstVotes: "0",
  abstainVotes: "0",
  quorumReached: false,
  voteSucceeded: false,

  // A finished proposal can be replaced: nothing about the previous one (its vote, what was read from the chain) may follow.
  // A stale "Succeeded" would also stop ProposalStatus from ever refreshing the new proposal.
  setProposal: (id, description, txHash) =>
    set({
      proposalId: id,
      description,
      proposalTxHash: txHash ?? null,
      voteTxHash: null,
      proposalState: null,
      forVotes: "0",
      againstVotes: "0",
      abstainVotes: "0",
      quorumReached: false,
      voteSucceeded: false,
    }),

  // A vote confirmed after its proposal was replaced or forgotten belongs to a finished journey.
  setVoteTx: (proposalId, hash) => set((state) => (state.proposalId === proposalId ? { voteTxHash: hash } : {})),

  clearProposal: () =>
    set({
      proposalId: null,
      description: "",
      proposalTxHash: null,
      voteTxHash: null,
      proposalState: null,
      forVotes: "0",
      againstVotes: "0",
      abstainVotes: "0",
      quorumReached: false,
      voteSucceeded: false,
    }),

  refreshFromChain: async () => {
    const { proposalId } = get();
    if (!proposalId) return;
    try {
      const gov = new Contract({ abi: governorAbi as Abi, address: GOVERNOR_ADDRESS, providerOrAccount: provider });
      const stateEnum = await gov.state(proposalId) as CairoCustomEnum;
      const proposalState = stateEnum.activeVariant() as ProposalState;

      if (isProposalClosed(proposalState)) {
        set({
          proposalState,
          quorumReached: Boolean(await gov.quorum_reached(proposalId)),
          voteSucceeded: Boolean(await gov.vote_succeeded(proposalId)),
        });
      } else {
        set({ proposalState });
      }
    } catch (e) {
      console.error("refreshFromChain:", e);
    }
  },
}));
