"use client";

import { useEffect, useState } from "react";
import { Box, Button, Text } from "@chakra-ui/react";
import { Contract, type Abi } from "starknet";
import { useProposalStore } from "@/app/store/proposalStore";
import { provider, GOVERNOR_ADDRESS } from "@/app/utils/constants";
import governorAbi from "@/app/abi/governor.json";

export default function ProposalStatus() {
  const { proposalId, proposalState, refreshFromChain, clearProposal } = useProposalStore();
  const [deadline, setDeadline] = useState<number | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);

  useEffect(() => {
    if (!proposalId) return;

    async function init() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gov = new Contract({ abi: governorAbi as Abi, address: GOVERNOR_ADDRESS, providerOrAccount: provider });
      const dead = Number(await gov.proposal_deadline(proposalId!));
      const cur = await provider.getBlockNumber();
      setDeadline(dead);
      setCurrentBlock(cur);
      refreshFromChain();
    }

    init();

    const interval = setInterval(() => {
      provider.getBlockNumber().then(setCurrentBlock);
      refreshFromChain();
    }, 30_000);

    return () => clearInterval(interval);
  }, [proposalId]);

  if (!proposalId) {
    return (
      <Text fontSize="sm" color="gray.500">
        No active proposal.
      </Text>
    );
  }

  const blocksLeft =
    deadline !== null && currentBlock !== null ? deadline - currentBlock : null;

  return (
    <Box mt={2}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Text fontSize="sm" color="gray.400">
          State:{" "}
          <Text as="span" color="white" fontWeight="semibold">
            {proposalState ?? "loading…"}
          </Text>
        </Text>
        <Button size="xs" variant="ghost" color="gray.500" onClick={clearProposal}>
          New vote
        </Button>
      </Box>
      {blocksLeft !== null && blocksLeft > 0 && (
        <Text fontSize="sm" color="gray.400">
          Ends in{" "}
          <Text as="span" color="white">
            {blocksLeft}
          </Text>{" "}
          blocks
        </Text>
      )}
    </Box>
  );
}
