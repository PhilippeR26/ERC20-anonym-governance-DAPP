"use client";

import { create } from "zustand";
import { constants } from "starknet";
import type { WalletAccountV5, RpcProvider } from "starknet";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";

const SN_MAIN = constants.StarknetChainId.SN_MAIN;

interface WalletState {
  isConnected: boolean;
  address: string;
  chainId: string;
  wrongNetwork: boolean;
  walletAccount: WalletAccountV5 | undefined;
  provider: RpcProvider | undefined;
  walletWSF: WalletWithStarknetFeatures | undefined;
  displaySelectWalletUI: boolean;

  setConnected: (v: boolean) => void;
  setAddress: (v: string) => void;
  setChainId: (v: string) => void;
  setWalletAccount: (v: WalletAccountV5) => void;
  setProvider: (v: RpcProvider) => void;
  setWalletWSF: (v: WalletWithStarknetFeatures) => void;
  setDisplaySelectWalletUI: (v: boolean) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  isConnected: false,
  address: "",
  chainId: "",
  wrongNetwork: false,
  walletAccount: undefined,
  provider: undefined,
  walletWSF: undefined,
  displaySelectWalletUI: false,

  setConnected: (v) => set({ isConnected: v }),
  setAddress: (v) => set({ address: v }),
  setChainId: (v) => set({ chainId: v, wrongNetwork: v !== SN_MAIN }),
  setWalletAccount: (v) => set({ walletAccount: v }),
  setProvider: (v) => set({ provider: v }),
  setWalletWSF: (v) => set({ walletWSF: v }),
  setDisplaySelectWalletUI: (v) => set({ displaySelectWalletUI: v }),
  disconnect: () =>
    set({
      isConnected: false,
      address: "",
      chainId: "",
      wrongNetwork: false,
      walletAccount: undefined,
      walletWSF: undefined,
      displaySelectWalletUI: false,
    }),
}));
