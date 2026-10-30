import { describe, it, expect, afterEach } from "vitest";
import { useWalletStore } from "../src/app/store/walletStore";

afterEach(() => {
  useWalletStore.getState().disconnect();
});

describe("setVotingPower", () => {
  it("keeps the voting power read for the connected address", () => {
    useWalletStore.getState().setAddress("0xa");

    useWalletStore.getState().setVotingPower("0xa", 5n);

    expect(useWalletStore.getState().votingPower).toBe(5n);
  });

  it("ignores a voting power read for an address that is no longer connected", () => {
    useWalletStore.getState().setAddress("0xb");

    useWalletStore.getState().setVotingPower("0xa", 5n);

    expect(useWalletStore.getState().votingPower).toBeNull();
  });
});

describe("disconnect", () => {
  it("forgets the voting power", () => {
    useWalletStore.getState().setAddress("0xa");
    useWalletStore.getState().setVotingPower("0xa", 5n);

    useWalletStore.getState().disconnect();

    expect(useWalletStore.getState().votingPower).toBeNull();
  });
});
