"use client";

import { Box, Text } from "@chakra-ui/react";
import { NETWORK } from "@/app/utils/network";

export type VoteStep = "idle" | "signing" | "generating" | "submitting" | "done" | "error";

interface Props {
  step: VoteStep;
  errorMessage?: string;
  txHash?: string;
  queue?: { position: number; etaSec: number };
}

const STEPS: { key: VoteStep; label: string }[] = [
  { key: "signing",    label: "Signing vote intent" },
  { key: "generating", label: "Generating ZK proof (~50s)" },
  { key: "submitting", label: "Submitting on-chain" },
  { key: "done",       label: "Vote recorded anonymously" },
];

const ORDER: VoteStep[] = ["signing", "generating", "submitting", "done"];

export default function VoteProgressStepper({ step, errorMessage, txHash, queue }: Props) {
  if (step === "idle") return null;

  return (
    <Box
      mt={4}
      p={3}
      bg="#1a1a2e"
      borderRadius="lg"
      border="1px solid"
      borderColor="#3b3b6b"
    >
      {step === "error" ? (
        <Text color="red.400" fontSize="sm">
          Error: {errorMessage ?? "Unknown error"}
        </Text>
      ) : (
        STEPS.map(({ key, label }) => {
          const idx = ORDER.indexOf(key);
          const currentIdx = ORDER.indexOf(step);
          const done = idx < currentIdx || step === "done";
          const active = idx === currentIdx && step !== "done";

          return (
            <Text
              key={key}
              fontSize="sm"
              mb={1}
              color={done ? "green.400" : active ? "indigo.400" : "gray.600"}
            >
              {done ? "✓" : active ? "⟳" : "○"}{" "}
              {key === "generating" && active && queue
                ? `Waiting in proof-server queue: position ${queue.position} (~${queue.etaSec} s)`
                : `${label}${active ? "…" : ""}`}
            </Text>
          );
        })
      )}
      {step === "done" && txHash && (
        <Text fontSize="xs" color="gray.400" mt={2}>
          Tx:{" "}
          <a
            href={`${NETWORK.explorerTxUrl}${txHash}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--chakra-colors-indigo-400)", textDecoration: "underline" }}
          >
            {txHash.slice(0, 10)}…
          </a>
        </Text>
      )}
    </Box>
  );
}
