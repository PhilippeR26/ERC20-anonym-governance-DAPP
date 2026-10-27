import { CairoBytes31, hash } from "starknet";

const NULLIFIER_DOMAIN = CairoBytes31.fromText("anon_governor_nullifier_v1").toHexString();

export function computeNullifier(proposalId: string, signature: string[]): string {
  const sigHash = hash.computePoseidonHashOnElements(signature);
  return hash.computePoseidonHashOnElements([NULLIFIER_DOMAIN, proposalId, sigHash]);
}
