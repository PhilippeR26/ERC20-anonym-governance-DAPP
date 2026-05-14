"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
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

interface ProposalStoreState {
  proposalId: string | null;
  description: string;

  proposalState: ProposalState;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  quorumReached: boolean;
  voteSucceeded: boolean;

  setProposal: (id: string, description: string) => void;
  clearProposal: () => void;
  refreshFromChain: () => Promise<void>;
}

export const useProposalStore = create<ProposalStoreState>()(
  persist(
    (set, get) => ({
      proposalId: null,
      description: "",
      proposalState: null,
      forVotes: "0",
      againstVotes: "0",
      abstainVotes: "0",
      quorumReached: false,
      voteSucceeded: false,

      setProposal: (id, description) => set({ proposalId: id, description }),

      clearProposal: () =>
        set({
          proposalId: null,
          description: "",
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

          if (
            proposalState &&
            ["Canceled", "Defeated", "Succeeded", "Queued", "Executed"].includes(proposalState)
          ) {
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
    }),
    {
      name: "anon-governance-proposal-v2",
      partialize: (state) => ({
        proposalId: state.proposalId,
        description: state.description,
      }),
    },
  ),
);
