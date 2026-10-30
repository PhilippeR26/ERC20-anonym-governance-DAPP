import { Account, RpcProvider, type Call } from "starknet";
import { getBackendAccountConfig, getRpcUrl } from "./serverConfig";

// The backend account as the party that sends and pays for the transactions of the demo journey.
export type Sponsor = {
  address: string;
  execute(calls: Call[]): Promise<{ transaction_hash: string }>;
  waitForTransaction(hash: string): Promise<unknown>;
};

export function getSponsor(): { provider: RpcProvider; account: Account; sponsor: Sponsor } {
  const provider = new RpcProvider({ nodeUrl: getRpcUrl() });
  const config = getBackendAccountConfig();
  const account = new Account({ provider, address: config.address, signer: config.privateKey });
  return {
    provider,
    account,
    sponsor: {
      address: config.address,
      execute: (calls) => account.execute(calls),
      waitForTransaction: (hash) => provider.waitForTransaction(hash),
    },
  };
}
