"use client";

import { Box, Link } from "@chakra-ui/react";
import { LuSquareArrowOutUpRight } from "react-icons/lu";

// New tab: leaving the page would drop the wallet connection and the journey in progress.
export default function LowerBanner() {
  return (
    <Box
      position="fixed"
      bottom={0}
      width="100%"
      p={2}
      textAlign="center"
      fontSize="sm"
      fontWeight="semibold"
      color="gray.400"
      bg="#1a1a2e"
      borderTop="1px solid"
      borderColor="whiteAlpha.200"
      opacity={0.95}
    >
      <Link href="https://github.com/PhilippeR26/ERC20-anonym-governance-DAPP" target="_blank" rel="noreferrer" color="blue.300">
        Repo <LuSquareArrowOutUpRight />
      </Link>
      {" - Powered by "}
      <Link href="https://github.com/starknet-io/starknet.js" target="_blank" rel="noreferrer" color="blue.300">
        Starknet.js v11.4.3 <LuSquareArrowOutUpRight />
      </Link>
    </Box>
  );
}
