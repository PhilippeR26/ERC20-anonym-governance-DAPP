import { describe, it, expect } from "vitest";
import { resolveNetwork } from "../src/app/utils/network";
import {
  getRpcUrl,
  getBackendAccountConfig,
  getProofServerTarget,
  listConfigProblems,
  VOTE_BUDGET_MS,
} from "../src/app/server/serverConfig";
import { maxDuration } from "../src/app/api/vote/route";

const SEPOLIA = resolveNetwork("sepolia");
const MAINNET = resolveNetwork("mainnet");

const BACKEND_ENV = {
  SEPOLIA_BACKEND_ACCOUNT_ADDRESS: "0xa",
  SEPOLIA_BACKEND_ACCOUNT_PRIVATE_KEY: "0xb",
  MAINNET_BACKEND_ACCOUNT_ADDRESS: "0xc",
  MAINNET_BACKEND_ACCOUNT_PRIVATE_KEY: "0xd",
};

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
    expect(getBackendAccountConfig(BACKEND_ENV, SEPOLIA)).toEqual({ address: "0xa", privateKey: "0xb" });
  });

  it("reads the MAINNET_ variables on mainnet", () => {
    expect(getBackendAccountConfig(BACKEND_ENV, MAINNET)).toEqual({ address: "0xc", privateKey: "0xd" });
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

  it("ignores the retired PROOF_SERVER_INSTANCE_URL", () => {
    expect(
      getProofServerTarget(
        {
          PROOF_SERVER_INSTANCE_URL: "http://192.168.1.26:3030",
          PROOF_SERVER_URL: "https://proof.example",
          PROOF_SERVER_API_KEY: "s",
        },
        SEPOLIA,
      ),
    ).toEqual({ url: "https://proof.example/sepolia", apiKey: "s" });
  });

  it("names PROOF_SERVER_URL when no proof server is configured", () => {
    expect(() => getProofServerTarget({}, SEPOLIA)).toThrow(
      "PROOF_SERVER_URL is not set (required for network sepolia)",
    );
  });

  it("names PROOF_SERVER_API_KEY when the key is missing or empty", () => {
    expect(() =>
      getProofServerTarget({ PROOF_SERVER_URL: "https://proof.example", PROOF_SERVER_API_KEY: "" }, SEPOLIA),
    ).toThrow("PROOF_SERVER_API_KEY is not set (required for network sepolia)");
  });
});

describe("listConfigProblems", () => {
  const COMPLETE = {
    ALCHEMY_API_KEY: "k",
    SEPOLIA_BACKEND_ACCOUNT_ADDRESS: "0xa",
    SEPOLIA_BACKEND_ACCOUNT_PRIVATE_KEY: "0xb",
    PROOF_SERVER_URL: "https://proof.example",
    PROOF_SERVER_API_KEY: "s",
  };

  it("lists every missing variable of the active network", () => {
    expect(listConfigProblems({}, SEPOLIA)).toEqual([
      "ALCHEMY_API_KEY is not set (required for network sepolia)",
      "SEPOLIA_BACKEND_ACCOUNT_ADDRESS is not set (required for network sepolia)",
      "SEPOLIA_BACKEND_ACCOUNT_PRIVATE_KEY is not set (required for network sepolia)",
      "PROOF_SERVER_URL is not set (required for network sepolia)",
      "PROOF_SERVER_API_KEY is not set (required for network sepolia)",
    ]);
  });

  it("reports nothing for a complete configuration", () => {
    expect(listConfigProblems(COMPLETE, SEPOLIA)).toEqual([]);
  });

  it("still requires the proof-server variables when the retired PROOF_SERVER_INSTANCE_URL is set", () => {
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
    ).toEqual([
      "PROOF_SERVER_URL is not set (required for network sepolia)",
      "PROOF_SERVER_API_KEY is not set (required for network sepolia)",
    ]);
  });
});

describe("vote route budget", () => {
  it("declares a maxDuration that matches VOTE_BUDGET_MS", () => {
    expect(maxDuration * 1000).toBe(VOTE_BUDGET_MS);
  });
});
