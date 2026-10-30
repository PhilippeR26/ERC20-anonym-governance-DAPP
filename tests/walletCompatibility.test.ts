import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import {
  checkCompatibility,
  PERMISSIONS_MAX_ATTEMPTS,
  PERMISSIONS_RETRY_MS,
} from "../src/app/utils/walletCompatibility";

function fakeWallet(request: (call: { type: string }) => Promise<unknown>): WalletWithStarknetFeatures {
  return { name: "Fake wallet", features: { "starknet:walletApi": { request } } } as unknown as WalletWithStarknetFeatures;
}

const silent = () => new Promise<never>(() => {});

describe("checkCompatibility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("is true as soon as the wallet answers wallet_getPermissions", async () => {
    const request = vi.fn(async () => []);

    expect(await checkCompatibility(fakeWallet(request))).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({ type: "wallet_getPermissions" });
  });

  it("is false, without asking again, when the wallet answers with an error", async () => {
    const request = vi.fn(async () => {
      throw new Error("unknown method");
    });

    expect(await checkCompatibility(fakeWallet(request))).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("asks again when the wallet is silent, and gives up after the last attempt", async () => {
    const request = vi.fn(silent);

    const verdict = checkCompatibility(fakeWallet(request));
    await vi.advanceTimersByTimeAsync(PERMISSIONS_RETRY_MS * PERMISSIONS_MAX_ATTEMPTS);

    expect(await verdict).toBe(false);
    expect(request).toHaveBeenCalledTimes(PERMISSIONS_MAX_ATTEMPTS);
  });

  it("is true when the wallet wakes up after a silent first attempt", async () => {
    let calls = 0;
    const request = vi.fn(() => (++calls === 1 ? silent() : Promise.resolve([])));

    const verdict = checkCompatibility(fakeWallet(request));
    await vi.advanceTimersByTimeAsync(PERMISSIONS_RETRY_MS);

    expect(await verdict).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
