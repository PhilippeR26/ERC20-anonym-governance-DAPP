"use client";

import { useEffect, useState } from "react";
import { Box, Button, Text } from "@chakra-ui/react";
import { Contract, type Abi } from "starknet";
import { useWalletStore } from "@/app/store/walletStore";
import { TOKEN_ADDRESS } from "@/app/utils/constants";
import tokenAbi from "@/app/abi/token.json";

export default function DelegationPanel() {
  const { walletAccount, address, provider } = useWalletStore();
  const [votingPower, setVotingPower] = useState<bigint | null>(null);
  const [delegating, setDelegating] = useState(false);

  async function fetchVotingPower() {
    if (!provider || !address) return;
    const token = new Contract({ abi: tokenAbi as Abi, address: TOKEN_ADDRESS, providerOrAccount: provider });
    const vp = await token.get_votes(address);
    setVotingPower(BigInt(vp.toString()));
  }

  useEffect(() => {
    fetchVotingPower();
  }, [walletAccount, address]);

  async function handleDelegate() {
    if (!walletAccount || !address) return;
    setDelegating(true);
    try {
      const token = new Contract({ abi: tokenAbi as Abi, address: TOKEN_ADDRESS, providerOrAccount: walletAccount });
      const call = token.populate("delegate", { delegatee: address });
      const { transaction_hash } = await walletAccount.execute(call);
      await provider!.waitForTransaction(transaction_hash);
      await fetchVotingPower();
    } finally {
      setDelegating(false);
    }
  }

  const hasPower = votingPower !== null && votingPower > 0n;

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      mb={4}
      p={3}
      bg="#1e2e1e"
      borderRadius="lg"
      border="1px solid"
      borderColor="#2d4a2d"
    >
      <Box>
        <Text fontSize="sm" color="gray.400">
          Voting power
        </Text>
        <Text fontSize="lg" fontWeight="semibold" color="green.400">
          {votingPower === null ? "…" : `${votingPower.toLocaleString()} TTKN`}
        </Text>
      </Box>
      {hasPower ? (
        <Text fontSize="xs" color="gray.500">
          ✓ Delegated to self
        </Text>
      ) : (
        <Button
          size="sm"
          colorPalette="green"
          loading={delegating}
          onClick={handleDelegate}
        >
          Delegate to myself
        </Button>
      )}
    </Box>
  );
}
