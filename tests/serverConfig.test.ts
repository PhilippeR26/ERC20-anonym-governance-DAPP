import { describe, it, expect } from "vitest";
import { resolveNetwork } from "../src/app/utils/network";
import {
  getRpcUrl,
  getBackendAccountConfig,
  getProofServerTarget,
  listConfigProblems,
} from "../src/app/server/serverConfig";

const SEPOLIA = resolveNetwork("sepolia");

describe("getRpcUrl", () => {
  it("derives the Alchemy URL from the network and the key", () => {
    expect(getRpcUrl({ ALCHEMY_API_KEY: "k" }, SEPOLIA)).toBe(
      "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/k",
    );
  });

  it("names ALCHEMY_API_KEY when it is missing or empty", () => {
    expect(() => getRpcUrl({ ALCHEMY_API_KEY: "" }, SEPOLIA)).toThrow(
      "ALCHEMY_API_KEY is not set (required for network sepolia)",
    );
  });
});

describe("getBackendAccountConfig", () => {
  it("reads the backend account of the active network only", () => {
    const env = {
      SEPOLIA_BACKEND_ACCOUNT_ADDRESS: "0xa",
      SEPOLIA_BACKEND_ACCOUNT_PRIVATE_KEY: "0xb",
      MAINNET_BACKEND_ACCOUNT_ADDRESS: "0xc",
      MAINNET_BACKEND_ACCOUNT_PRIVATE_KEY: "0xd",
    };
    expect(getBackendAccountConfig(env, SEPOLIA)).toEqual({ address: "0xa", privateKey: "0xb" });
  });

  it("names the missing backend variable", () => {
    expect(() => getBackendAccountConfig({ SEPOLIA_BACKEND_ACCOUNT_ADDRESS: "0xa" }, SEPOLIA)).toThrow(
      "SEPOLIA_BACKEND_ACCOUNT_PRIVATE_KEY is not set (required for network sepolia)",
    );
  });
});

describe("getProofServerTarget", () => {
  it("appends the instance path to PROOF_SERVER_URL and sends the key", () => {
    expect(
      getProofServerTarget({ PROOF_SERVER_URL: "https://proof.example/", PROOF_SERVER_API_KEY: "s" }, SEPOLIA),
    ).toEqual({ url: "https://proof.example/sepolia", apiKey: "s" });
  });

  it("uses PROOF_SERVER_INSTANCE_URL as is, without the key", () => {
    expect(
      getProofServerTarget(
        {
          PROOF_SERVER_INSTANCE_URL: "http://192.168.1.26:3030/",
          PROOF_SERVER_URL: "https://proof.example",
          PROOF_SERVER_API_KEY: "s",
        },
        SEPOLIA,
      ),
    ).toEqual({ url: "http://192.168.1.26:3030", apiKey: undefined });
  });

  it("names PROOF_SERVER_URL when no proof server is configured", () => {
    expect(() => getProofServerTarget({}, SEPOLIA)).toThrow(
      "PROOF_SERVER_URL is not set (required for network sepolia)",
    );
  });
});

describe("listConfigProblems", () => {
  it("lists every missing variable of the active network", () => {
    expect(listConfigProblems({}, SEPOLIA)).toEqual([
      "ALCHEMY_API_KEY is not set (required for network sepolia)",
      "SEPOLIA_BACKEND_ACCOUNT_ADDRESS is not set (required for network sepolia)",
      "SEPOLIA_BACKEND_ACCOUNT_PRIVATE_KEY is not set (required for network sepolia)",
      "PROOF_SERVER_URL is not set (required for network sepolia)",
      "PROOF_SERVER_API_KEY is not set (required for network sepolia)",
    ]);
  });

  it("does not require the public proof-server variables with the LAN override", () => {
    expect(
      listConfigProblems(
        {
          ALCHEMY_API_KEY: "k",
          SEPOLIA_BACKEND_ACCOUNT_ADDRESS: "0xa",
          SEPOLIA_BACKEND_ACCOUNT_PRIVATE_KEY: "0xb",
          PROOF_SERVER_INSTANCE_URL: "http://192.168.1.26:3030",
        },
        SEPOLIA,
      ),
    ).toEqual([]);
  });
});
