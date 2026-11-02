"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import ConnectWallet from "@/app/components/wallet/ConnectWallet";
import AdminBlock from "@/app/components/admin/AdminBlock";
import DelegationPanel from "@/app/components/voter/DelegationPanel";
import VoterBlock from "@/app/components/voter/VoterBlock";
import NetworkBadge from "@/app/components/network/NetworkBadge";
import WrongNetworkBanner from "@/app/components/network/WrongNetworkBanner";
import ConfigBanner from "@/app/components/network/ConfigBanner";
import LowerBanner from "@/app/components/LowerBanner";

export default function Home() {
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
        <Flex align="center">
          <Text fontWeight="bold" fontSize="lg" letterSpacing="wider">
            Anon Governance Demo
          </Text>
          <NetworkBadge />
        </Flex>
        <ConnectWallet />
      </Flex>

      <ConfigBanner />
      <WrongNetworkBanner />

      <Box maxW="720px" mx="auto" pt={4} pb={16} px={4}>
        <DelegationPanel />
        <AdminBlock />
        <VoterBlock />
      </Box>

      <LowerBanner />
    </Box>
  );
}
