import { constants } from "starknet";

export type NetworkName = "sepolia" | "mainnet";

export interface NetworkConfig {
  name: NetworkName;
  chainId: string;
  badgeLabel: string;
  walletName: string;
  alchemyHost: string;
  explorerTxUrl: string;
  proofInstancePath: string;
  governorAddress: string;
  tokenAddress: string;
}

export type AddressOverrides = Partial<Record<NetworkName, { governor?: string; token?: string }>>;

const NETWORKS: Record<NetworkName, NetworkConfig> = {
  sepolia: {
    name: "sepolia",
    chainId: constants.StarknetChainId.SN_SEPOLIA,
    badgeLabel: "Sepolia testnet",
    walletName: "Starknet Sepolia",
    alchemyHost: "starknet-sepolia.g.alchemy.com",
    explorerTxUrl: "https://sepolia.starkscan.co/tx/",
    proofInstancePath: "sepolia",
    governorAddress: "0x64834acb5abf44bc0173291722679c41bad701517033bb6c64b0bb9a2342a89",
    tokenAddress: "0x7e3b05750d37c5cbf3d17182fa1ebafb2663e893735c3b11969ac65239118a6",
  },
  mainnet: {
    name: "mainnet",
    chainId: constants.StarknetChainId.SN_MAIN,
    badgeLabel: "Mainnet",
    walletName: "Starknet Mainnet",
    alchemyHost: "starknet-mainnet.g.alchemy.com",
    explorerTxUrl: "https://starkscan.co/tx/",
    proofInstancePath: "mainnet",
    governorAddress: "0xdb568a74d33ecf4582265d1196b946f40743c08c39dcdc692bf1053bef14f2",
    tokenAddress: "0x4713a80db5e910a0218dd1a3e1ee9218c8076c5c9e005a31e8b8f8dc226877a",
  },
};

export function resolveNetwork(value: string | undefined, overrides: AddressOverrides = {}): NetworkConfig {
  if (!value) throw new Error('NEXT_PUBLIC_NETWORK is not set: it must be "sepolia" or "mainnet"');
  if (value !== "sepolia" && value !== "mainnet") {
    throw new Error(`NEXT_PUBLIC_NETWORK must be "sepolia" or "mainnet", got "${value}"`);
  }
  const network = NETWORKS[value];
  const override = overrides[value] ?? {};
  return {
    ...network,
    governorAddress: override.governor || network.governorAddress,
    tokenAddress: override.token || network.tokenAddress,
  };
}

// Each NEXT_PUBLIC_* read is written out in full: Next.js inlines only literal process.env accesses in client code.
export const NETWORK: NetworkConfig = resolveNetwork(process.env.NEXT_PUBLIC_NETWORK, {
  sepolia: {
    governor: process.env.NEXT_PUBLIC_SEPOLIA_GOVERNOR_ADDRESS,
    token: process.env.NEXT_PUBLIC_SEPOLIA_TOKEN_ADDRESS,
  },
  mainnet: {
    governor: process.env.NEXT_PUBLIC_MAINNET_GOVERNOR_ADDRESS,
    token: process.env.NEXT_PUBLIC_MAINNET_TOKEN_ADDRESS,
  },
});
