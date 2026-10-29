"use client";

import { Box } from "@chakra-ui/react";
import { useWalletStore } from "@/app/store/walletStore";
import { wrongNetworkMessage } from "@/app/utils/network";

export default function WrongNetworkBanner() {
  const { isConnected, wrongNetwork, chainId } = useWalletStore();
  if (!isConnected || !wrongNetwork) return null;

  return (
    <Box bg="red.950" borderBottom="1px solid" borderColor="red.800" px={5} py={2} fontSize="sm" color="red.400">
      {wrongNetworkMessage(chainId)}
    </Box>
  );
}
