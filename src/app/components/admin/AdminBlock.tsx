"use client";

import { Box } from "@chakra-ui/react";
import ProposeForm from "./ProposeForm";
import ProposalStatus from "./ProposalStatus";
import VoteResults from "./VoteResults";
import { useWalletStore } from "@/app/store/walletStore";

export default function AdminBlock() {
  const { isConnected, wrongNetwork } = useWalletStore();
  if (!isConnected || wrongNetwork) return null;

  return (
    <Box
      border="1px solid"
      borderColor="#3b3b6b"
      borderRadius="xl"
      overflow="hidden"
      mb={4}
    >
      <Box
        bg="#1e1e4a"
        px={4}
        py={2}
        fontSize="xs"
        fontWeight="bold"
        letterSpacing="widest"
        textTransform="uppercase"
        color="indigo.300"
      >
        Administrator
      </Box>
      <Box bg="#12122a" p={5}>
        <ProposeForm />
        <ProposalStatus />
        <VoteResults />
      </Box>
    </Box>
  );
}
