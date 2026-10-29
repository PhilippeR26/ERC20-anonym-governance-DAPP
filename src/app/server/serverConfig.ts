import { NETWORK, type NetworkConfig } from "@/app/utils/network";

export type Env = Record<string, string | undefined>;

export class ConfigError extends Error {}

export type ProofServerTarget = { url: string; apiKey?: string };

export const VOTE_BUDGET_MS = 300_000;
export const SUBMISSION_MARGIN_MS = 30_000;

function missingMessage(name: string, network: NetworkConfig): string {
  return `${name} is not set (required for network ${network.name})`;
}

function required(env: Env, name: string, network: NetworkConfig): string {
  const value = env[name];
  if (!value) throw new ConfigError(missingMessage(name, network));
  return value;
}

function backendVariables(network: NetworkConfig): { address: string; privateKey: string } {
  const prefix = network.name.toUpperCase();
  return { address: `${prefix}_BACKEND_ACCOUNT_ADDRESS`, privateKey: `${prefix}_BACKEND_ACCOUNT_PRIVATE_KEY` };
}

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, "");

export function getRpcUrl(env: Env = process.env, network: NetworkConfig = NETWORK): string {
  const key = required(env, "ALCHEMY_API_KEY", network);
  return `https://${network.alchemyHost}/starknet/version/rpc/v0_10/${key}`;
}

export function getBackendAccountConfig(
  env: Env = process.env,
  network: NetworkConfig = NETWORK,
): { address: string; privateKey: string } {
  const names = backendVariables(network);
  return {
    address: required(env, names.address, network),
    privateKey: required(env, names.privateKey, network),
  };
}

export function getProofServerTarget(env: Env = process.env, network: NetworkConfig = NETWORK): ProofServerTarget {
  // TEMPORARY: LAN proof server for the user's tests, remove before production
  if (env.PROOF_SERVER_INSTANCE_URL) {
    return { url: withoutTrailingSlash(env.PROOF_SERVER_INSTANCE_URL), apiKey: undefined };
  }
  const base = withoutTrailingSlash(required(env, "PROOF_SERVER_URL", network));
  return { url: `${base}/${network.proofInstancePath}`, apiKey: env.PROOF_SERVER_API_KEY || undefined };
}

export function listConfigProblems(env: Env = process.env, network: NetworkConfig = NETWORK): string[] {
  const backend = backendVariables(network);
  const names = ["ALCHEMY_API_KEY", backend.address, backend.privateKey];
  // TEMPORARY: LAN proof server for the user's tests, remove before production
  if (!env.PROOF_SERVER_INSTANCE_URL) names.push("PROOF_SERVER_URL", "PROOF_SERVER_API_KEY");
  return names.filter((name) => !env[name]).map((name) => missingMessage(name, network));
}
