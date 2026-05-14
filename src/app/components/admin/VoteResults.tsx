"use client";

import { Box, Text } from "@chakra-ui/react";
import { useProposalStore } from "@/app/store/proposalStore";

export default function VoteResults() {
  const { proposalState, quorumReached, voteSucceeded } = useProposalStore();

  if (!["Canceled", "Defeated", "Succeeded", "Queued", "Executed"].includes(proposalState ?? "")) return null;

  return (
    <Box
      mt={4}
      p={3}
      bg="#0f1f0f"
      borderRadius="lg"
      border="1px solid"
      borderColor="green.900"
    >
      <Text fontSize="sm" color="green.400" fontWeight="semibold">
        Vote ended
      </Text>
      <Text fontSize="sm" color="gray.400" mt={1}>
        Quorum reached: {quorumReached ? "✓" : "✗"} · Result:{" "}
        <Text as="span" color={voteSucceeded ? "green.400" : "red.400"}>
          {voteSucceeded ? "Succeeded" : "Defeated"}
        </Text>
      </Text>
    </Box>
  );
}
