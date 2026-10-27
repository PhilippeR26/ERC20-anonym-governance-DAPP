"use client";

import { useEffect, useState } from "react";
import { Box, Button, Text } from "@chakra-ui/react";
import { Contract, type Abi } from "starknet";
import { useWalletStore } from "@/app/store/walletStore";
import { useProposalStore, isProposalClosed } from "@/app/store/proposalStore";
import { buildAnonVoteTypedData } from "@/app/utils/typedData";
import { computeNullifier } from "@/app/utils/nullifier";
import { generateProof } from "@/app/server/generateProof";
import { GOVERNOR_ADDRESS, REFERENCE_BLOCK_LAG, CHAIN_POLL_INTERVAL_MS } from "@/app/utils/constants";
import governorAbi from "@/app/abi/governor.json";
import VoteProgressStepper, { type VoteStep } from "./VoteProgressStepper";

const CHOICES = [
  { value: 1, label: "✓ For",     colorPalette: "green", textColor: "green.400" },
  { value: 0, label: "✗ Against", colorPalette: "red",   textColor: "red.400"   },
  { value: 2, label: "— Abstain", colorPalette: "gray",  textColor: "gray.200"  },
] as const;

type Choice = typeof CHOICES[number];

export default function VotePanel() {
  const [voteStep, setVoteStep] = useState<VoteStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [txHash, setTxHash] = useState<string>();
  const [activeChoice, setActiveChoice] = useState<Choice | null>(null);

  const { walletAccount, walletWSF, address, chainId, provider } = useWalletStore();
  const { proposalId, description, proposalState, refreshFromChain } = useProposalStore();
  const [voteWindow, setVoteWindow] = useState<{ snapshot: number; deadline: number }>();
  const [headBlock, setHeadBlock] = useState<number>();

  const closed = isProposalClosed(proposalState);

  useEffect(() => {
    if (!proposalId || !provider || closed) return;
    const gov = new Contract({ abi: governorAbi as Abi, address: GOVERNOR_ADDRESS, providerOrAccount: provider });
    Promise.all([gov.proposal_snapshot(proposalId), gov.proposal_deadline(proposalId)]).then(([snapshot, deadline]) =>
      setVoteWindow({ snapshot: Number(snapshot), deadline: Number(deadline) }),
    );
    const pollHead = () => provider.getBlockNumber().then(setHeadBlock);
    pollHead();
    const interval = setInterval(pollHead, CHAIN_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [proposalId, provider, closed]);

  if (!proposalId) return null;

  const isActive = proposalState === "Active";
  // The proof's reference block (head - lag) must be inside the voting window.
  const referenceBlockInWindow =
    voteWindow !== undefined &&
    headBlock !== undefined &&
    headBlock - REFERENCE_BLOCK_LAG > voteWindow.snapshot &&
    headBlock <= voteWindow.deadline;

  async function handleVote(choice: Choice) {
    if (!walletAccount || !walletWSF || !proposalId || !address || !chainId) return;

    setActiveChoice(choice);
    setVoteStep("signing");
    setErrorMessage(undefined);
    setTxHash(undefined);

    try {
      const td = buildAnonVoteTypedData(proposalId, choice.value, chainId);
      const signature = (await walletWSF.features["starknet:walletApi"].request({
        type: "wallet_signTypedData",
        params: td,
      })) as string[];

      const nullifier = computeNullifier(proposalId, signature);
      const gov = new Contract({ abi: governorAbi as Abi, address: GOVERNOR_ADDRESS, providerOrAccount: provider });
      const used = Boolean(await gov.is_nullifier_used(proposalId, nullifier));
      if (used) {
        setVoteStep("error");
        setErrorMessage("You have already voted on this proposal.");
        return;
      }

      setVoteStep("generating");
      const { transaction_hash } = await generateProof(
        proposalId,
        choice.value,
        address,
        signature,
      );

      setVoteStep("submitting");
      await provider!.waitForTransaction(transaction_hash);

      setTxHash(transaction_hash);
      setVoteStep("done");
      await refreshFromChain();
    } catch (err: unknown) {
      setVoteStep("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Box>
      {description && (
        <Box mb={3}>
          <Text fontSize="sm" color="gray.400" mb={1}>
            Active proposal
          </Text>
          <Text fontSize="md" fontWeight="medium" color="gray.100">
            {description}
          </Text>
        </Box>
      )}

      {!isActive && proposalState && (
        <Text fontSize="sm" color="gray.500" mb={3}>
          Voting is {proposalState === "Pending" ? "not yet open" : "closed"}.
        </Text>
      )}

      <Box display="flex" gap={3}>
        {CHOICES.map((choice) => (
          <Button
            key={choice.value}
            flex={1}
            colorPalette={choice.colorPalette}
            disabled={!isActive || !referenceBlockInWindow || voteStep !== "idle"}
            onClick={() => handleVote(choice)}
          >
            {choice.label}
          </Button>
        ))}
      </Box>

      {activeChoice && voteStep !== "idle" && (
        <Text fontSize="sm" color="gray.400" mt={3}>
          Your vote:{" "}
          <Text as="span" fontWeight="semibold" color={activeChoice.textColor}>
            {activeChoice.label}
          </Text>
        </Text>
      )}

      <VoteProgressStepper step={voteStep} errorMessage={errorMessage} txHash={txHash} />
      {voteStep === "error" && (
        <Button
          size="sm"
          variant="ghost"
          mt={2}
          onClick={() => { setVoteStep("idle"); setErrorMessage(undefined); setActiveChoice(null); }}
        >
          Try again
        </Button>
      )}
    </Box>
  );
}
