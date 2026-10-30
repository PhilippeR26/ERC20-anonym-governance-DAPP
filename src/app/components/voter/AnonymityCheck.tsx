"use client";

import { Box, Text } from "@chakra-ui/react";
import { validateAndParseAddress } from "starknet";
import { useWalletStore } from "@/app/store/walletStore";
import { useProposalStore } from "@/app/store/proposalStore";
import { useGrantStore } from "@/app/store/grantStore";
import { GRANT_AMOUNT } from "@/app/utils/constants";
import { NETWORK } from "@/app/utils/network";

const GRANT_TOKENS = (GRANT_AMOUNT / 10n ** 18n).toLocaleString("en-US");

type TxLink = { label: string; hash: string };

export default function AnonymityCheck() {
  const { address } = useWalletStore();
  const { proposalTxHash, voteTxHash } = useProposalStore();
  const grants = useGrantStore((state) => state.grants);

  if (!voteTxHash) return null;

  const candidates: { label: string; hash: string | null | undefined }[] = [
    { label: "Grant", hash: address ? grants[validateAndParseAddress(address)] : undefined },
    { label: "Proposal", hash: proposalTxHash },
    { label: "Vote", hash: voteTxHash },
  ];
  const links = candidates.filter((link): link is TxLink => Boolean(link.hash));

  return (
    <Box mt={4} p={3} bg="#1a1a2e" borderRadius="lg" border="1px solid" borderColor="#3b3b6b">
      <Text fontSize="sm" color="green.400" fontWeight="semibold">
        Anonymity check
      </Text>
      <Box display="flex" flexWrap="wrap" gap={4} mt={2}>
        {links.map(({ label, hash }) => (
          <Text key={label} fontSize="xs" color="gray.400">
            {label}:{" "}
            <a
              href={`${NETWORK.explorerTxUrl}${hash}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--chakra-colors-indigo-400)", textDecoration: "underline" }}
            >
              {hash.slice(0, 10)}…
            </a>
          </Text>
        ))}
      </Box>
      <Text fontSize="sm" color="gray.400" mt={3}>
        The vote was sent by the sponsor account, not by your wallet, and its event holds only the proposal, a
        nullifier, the choice and the weight: {GRANT_TOKENS} tokens for every visitor who took the grant. Only the
        grant transaction names your address: the right to vote is public, the vote is not.
      </Text>
    </Box>
  );
}
