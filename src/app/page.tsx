"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import ConnectWallet from "@/app/components/wallet/ConnectWallet";
import AdminBlock from "@/app/components/admin/AdminBlock";
import VoterBlock from "@/app/components/voter/VoterBlock";
import { useWalletStore } from "@/app/store/walletStore";

export default function Home() {
  const { isConnected, wrongNetwork } = useWalletStore();

  return (
    <Box minH="100vh" bg="#0d0d1a">
      <Flex
        align="center"
        justify="space-between"
        px={5}
        py={3}
        borderBottom="1px solid"
        borderColor="whiteAlpha.200"
        bg="#1a1a2e"
      >
        <Text fontWeight="bold" fontSize="lg" letterSpacing="wider">
          Anon Governance Demo
        </Text>
        <ConnectWallet />
      </Flex>

      {isConnected && wrongNetwork && (
        <Box
          bg="red.950"
          borderBottom="1px solid"
          borderColor="red.800"
          px={5}
          py={2}
          fontSize="sm"
          color="red.400"
        >
          Wrong network. Please switch your wallet to Starknet Mainnet.
        </Box>
      )}

      <Box maxW="720px" mx="auto" py={4} px={4}>
        <AdminBlock />
        <VoterBlock />
      </Box>
    </Box>
  );
}
