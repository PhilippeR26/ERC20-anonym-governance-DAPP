"use client";

import { useState } from "react";
import { Box, Button, Text, Textarea } from "@chakra-ui/react";
import type { CreatedProposal } from "@/app/server/createProposal";
import { useWalletStore } from "@/app/store/walletStore";
import { useProposalStore, isProposalClosed } from "@/app/store/proposalStore";
import { postJson } from "@/app/utils/postJson";
import { DESCRIPTION_MAX_LENGTH } from "@/app/utils/constants";

export default function ProposeForm() {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>();

  const { isConnected, address, provider, votingPower } = useWalletStore();
  const { proposalId, proposalState, setProposal } = useProposalStore();

  if (!isConnected || (proposalId && !isProposalClosed(proposalState))) return null;

  const hasPower = votingPower !== null && votingPower > 0n;

  async function handleLaunchVote() {
    if (!provider || !description.trim()) return;
    setStatus("pending");
    setErrorMessage(undefined);
    try {
      const created = await postJson<CreatedProposal>("/api/propose", { description });
      await provider.waitForTransaction(created.transactionHash);
      // A proposal confirmed after its wallet was disconnected belongs to a finished journey.
      if (useWalletStore.getState().address !== address) return;
      setProposal(created.proposalId, created.description, created.transactionHash);
      setStatus("idle");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Box mb={4}>
      <Text fontSize="sm" color="gray.400" mb={2}>
        Proposal description
      </Text>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the vote…"
        maxLength={DESCRIPTION_MAX_LENGTH}
        mb={3}
        bg="#1a1a3a"
        borderColor="whiteAlpha.200"
        resize="vertical"
      />
      <Button
        colorPalette="indigo"
        loading={status === "pending"}
        disabled={!description.trim() || status !== "idle" || !hasPower}
        onClick={handleLaunchVote}
      >
        Launch vote
      </Button>
      {!hasPower && (
        <Text fontSize="sm" color="gray.500" mt={2}>
          Get your voting power first: it must exist before a vote is created.
        </Text>
      )}
      {status === "pending" && (
        <Text fontSize="sm" color="gray.400" mt={2}>
          The sponsor is creating the vote…
        </Text>
      )}
      {status === "error" && (
        <Box mt={2}>
          <Text color="red.400" fontSize="sm">
            Error: {errorMessage ?? "Unknown error"}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            mt={2}
            onClick={() => {
              setStatus("idle");
              setErrorMessage(undefined);
            }}
          >
            Try again
          </Button>
        </Box>
      )}
    </Box>
  );
}
