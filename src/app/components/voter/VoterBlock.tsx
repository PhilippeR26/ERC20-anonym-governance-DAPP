"use client";

import { Box } from "@chakra-ui/react";
import VotePanel from "./VotePanel";
import AnonymityCheck from "./AnonymityCheck";
import VoteResults from "@/app/components/admin/VoteResults";
import { useWalletStore } from "@/app/store/walletStore";
import { useProposalStore } from "@/app/store/proposalStore";

export default function VoterBlock() {
  const { isConnected, wrongNetwork } = useWalletStore();
  // VotePanel is remounted for each proposal: no step or error of the previous one may show.
  const proposalId = useProposalStore((state) => state.proposalId);
  if (!isConnected || wrongNetwork) return null;

  return (
    <Box
      border="1px solid"
      borderColor="#3b4a3b"
      borderRadius="xl"
      overflow="hidden"
    >
      <Box
        bg="#1a2e1a"
        px={4}
        py={2}
        fontSize="xs"
        fontWeight="bold"
        letterSpacing="widest"
        textTransform="uppercase"
        color="green.400"
      >
        Voter
      </Box>
      <Box bg="#111a11" p={5}>
        <VotePanel key={proposalId ?? "none"} />
        <VoteResults />
        <AnonymityCheck />
      </Box>
    </Box>
  );
}
