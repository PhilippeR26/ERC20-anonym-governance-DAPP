import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";

export const PERMISSIONS_RETRY_MS = 3000;
export const PERMISSIONS_MAX_ATTEMPTS = 3;

const wait = (ms: number) => new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms));

// Asks the wallet for its permissions to find out whether it speaks the Wallet API.
// An extension still starting up may never answer the first request, so the request is sent again after PERMISSIONS_RETRY_MS, up to PERMISSIONS_MAX_ATTEMPTS times.
export async function checkCompatibility(wallet: WalletWithStarknetFeatures): Promise<boolean> {
  for (let attempt = 1; attempt <= PERMISSIONS_MAX_ATTEMPTS; attempt++) {
    try {
      const answer = await Promise.race([
        wallet.features["starknet:walletApi"].request({ type: "wallet_getPermissions" }),
        wait(PERMISSIONS_RETRY_MS),
      ]);
      if (answer !== "timeout") {
        console.log(`Wallet ${wallet.name} is compatible (attempt ${attempt})`);
        return true;
      }
    } catch (err) {
      console.log(`Wallet ${wallet.name} is NOT compatible:`, err);
      return false; // the wallet answered with an error
    }
  }
  console.log(`Wallet ${wallet.name} did not answer after ${PERMISSIONS_MAX_ATTEMPTS} attempts`);
  return false;
}
