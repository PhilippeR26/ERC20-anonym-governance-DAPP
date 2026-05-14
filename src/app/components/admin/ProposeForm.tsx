"use client";

import { useState } from "react";
import { Box, Button, Text, Textarea } from "@chakra-ui/react";
import { Contract, type Abi } from "starknet";
import { useWalletStore } from "@/app/store/walletStore";
import { useProposalStore } from "@/app/store/proposalStore";
import { hashProposal } from "@/app/utils/hashProposal";
import { GOVERNOR_ADDRESS } from "@/app/utils/constants";
import governorAbi from "@/app/abi/governor.json";

export default function ProposeForm() {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");

  const { walletAccount, isConnected, provider } = useWalletStore();
  const { proposalId, setProposal } = useProposalStore();

  if (!isConnected || proposalId) return null;

  async function handleLaunchVote() {
    if (!walletAccount || !description.trim()) return;
    setStatus("pending");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gov = new Contract({ abi: governorAbi as Abi, address: GOVERNOR_ADDRESS, providerOrAccount: walletAccount });
      const call = gov.populate("propose", { calls: [], description });
      const { transaction_hash } = await walletAccount.execute(call);
      await provider!.waitForTransaction(transaction_hash);
      setProposal(hashProposal(description), description);
    } catch (err) {
      console.error(err);
      setStatus("error");
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
        mb={3}
        bg="#1a1a3a"
        borderColor="whiteAlpha.200"
        resize="vertical"
      />
      <Button
        colorPalette="indigo"
        loading={status === "pending"}
        disabled={!description.trim() || status === "pending"}
        onClick={handleLaunchVote}
      >
        Launch vote
      </Button>
      {status === "error" && (
        <Text color="red.400" fontSize="sm" mt={2}>
          Transaction failed. Check console.
        </Text>
      )}
    </Box>
  );
}
