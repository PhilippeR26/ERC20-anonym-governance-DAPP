import { describe, it, expect } from "vitest";
import { constants } from "starknet";
import { resolveNetwork, NETWORK } from "../src/app/utils/network";

describe("resolveNetwork", () => {
  it("returns the Sepolia table", () => {
    expect(resolveNetwork("sepolia")).toEqual({
      name: "sepolia",
      chainId: constants.StarknetChainId.SN_SEPOLIA,
      badgeLabel: "Sepolia testnet",
      walletName: "Starknet Sepolia",
      alchemyHost: "starknet-sepolia.g.alchemy.com",
      explorerTxUrl: "https://sepolia.starkscan.co/tx/",
      proofInstancePath: "sepolia",
      governorAddress: "0x64834acb5abf44bc0173291722679c41bad701517033bb6c64b0bb9a2342a89",
      tokenAddress: "0x7e3b05750d37c5cbf3d17182fa1ebafb2663e893735c3b11969ac65239118a6",
    });
  });

  it("returns the Mainnet table", () => {
    expect(resolveNetwork("mainnet")).toEqual({
      name: "mainnet",
      chainId: constants.StarknetChainId.SN_MAIN,
      badgeLabel: "Mainnet",
      walletName: "Starknet Mainnet",
      alchemyHost: "starknet-mainnet.g.alchemy.com",
      explorerTxUrl: "https://starkscan.co/tx/",
      proofInstancePath: "mainnet",
      governorAddress: "0xdb568a74d33ecf4582265d1196b946f40743c08c39dcdc692bf1053bef14f2",
      tokenAddress: "0x4713a80db5e910a0218dd1a3e1ee9218c8076c5c9e005a31e8b8f8dc226877a",
    });
  });

  it("applies an address override to its own network only", () => {
    const overrides = { sepolia: { governor: "0x123" } };
    expect(resolveNetwork("sepolia", overrides).governorAddress).toBe("0x123");
    expect(resolveNetwork("mainnet", overrides).governorAddress).toBe(
      "0xdb568a74d33ecf4582265d1196b946f40743c08c39dcdc692bf1053bef14f2",
    );
  });

  it("ignores an empty override", () => {
    expect(resolveNetwork("sepolia", { sepolia: { token: "" } }).tokenAddress).toBe(
      "0x7e3b05750d37c5cbf3d17182fa1ebafb2663e893735c3b11969ac65239118a6",
    );
  });

  it("rejects a missing value", () => {
    expect(() => resolveNetwork(undefined)).toThrow(
      'NEXT_PUBLIC_NETWORK is not set: it must be "sepolia" or "mainnet"',
    );
  });

  it("rejects an unknown value", () => {
    expect(() => resolveNetwork("testnet")).toThrow(
      'NEXT_PUBLIC_NETWORK must be "sepolia" or "mainnet", got "testnet"',
    );
  });

  it("resolves NETWORK from NEXT_PUBLIC_NETWORK", () => {
    expect(NETWORK.name).toBe("sepolia");
  });
});
