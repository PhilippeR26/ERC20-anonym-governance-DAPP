import { hash, shortString } from "starknet";

const NULLIFIER_DOMAIN = shortString.encodeShortString("anon_governor_nullifier_v1");

export function computeNullifier(proposalId: string, signature: string[]): string {
  const sigHash = hash.computePoseidonHashOnElements(signature);
  return hash.computePoseidonHashOnElements([NULLIFIER_DOMAIN, proposalId, sigHash]);
}
