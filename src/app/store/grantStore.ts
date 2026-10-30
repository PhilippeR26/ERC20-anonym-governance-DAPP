"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { validateAndParseAddress } from "starknet";
import { NETWORK } from "@/app/utils/network";

interface GrantStoreState {
  // normalised address -> hash of the transaction that gave it its voting power
  grants: Record<string, string>;
  setGrant: (address: string, transactionHash: string) => void;
}

export const useGrantStore = create<GrantStoreState>()(
  persist(
    (set) => ({
      grants: {},
      setGrant: (address, transactionHash) =>
        set((state) => ({ grants: { ...state.grants, [validateAndParseAddress(address)]: transactionHash } })),
    }),
    { name: `anon-governance-grants-v1-${NETWORK.name}` },
  ),
);
