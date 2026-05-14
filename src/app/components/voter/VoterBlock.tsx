"use client";

import { Box } from "@chakra-ui/react";
import DelegationPanel from "./DelegationPanel";
import VotePanel from "./VotePanel";
import { useWalletStore } from "@/app/store/walletStore";

export default function VoterBlock() {
  const { isConnected, wrongNetwork } = useWalletStore();
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
        <DelegationPanel />
        <VotePanel />
      </Box>
    </Box>
  );
}
