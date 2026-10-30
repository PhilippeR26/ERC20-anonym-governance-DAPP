"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Text } from "@chakra-ui/react";
import { Contract, type Abi } from "starknet";
import { useWalletStore } from "@/app/store/walletStore";
import { useGrantStore } from "@/app/store/grantStore";
import { buildDelegationTypedData } from "@/app/utils/typedData";
import { postJson } from "@/app/utils/postJson";
import { TOKEN_ADDRESS, DELEGATION_VALIDITY_SEC } from "@/app/utils/constants";
import tokenAbi from "@/app/abi/token.json";
import { DelegationSignatureGuide } from "./SignatureGuides";

type Step = "idle" | "signing" | "granting" | "confirming" | "error";

const PENDING_TEXT = {
  signing: "Waiting for your signature…",
  granting: "The sponsor is sending the transaction…",
  confirming: "Waiting for the transaction to be accepted…",
} as const;

const ONE_TOKEN = 10n ** 18n;

export default function DelegationPanel() {
  const { isConnected, wrongNetwork, address } = useWalletStore();
  if (!isConnected || wrongNetwork) return null;
  // Each account gets a fresh panel: no step or error of the previous one may show.
  return <VotingPowerPanel key={address} />;
}

function VotingPowerPanel() {
  const { walletWSF, address, chainId, provider, votingPower, setVotingPower } = useWalletStore();
  const setGrant = useGrantStore((state) => state.setGrant);
  const [step, setStep] = useState<Step>("idle");
  const [errorMessage, setErrorMessage] = useState<string>();

  const refreshVotingPower = useCallback(async () => {
    if (!provider || !address) return;
    try {
      const token = new Contract({ abi: tokenAbi as Abi, address: TOKEN_ADDRESS, providerOrAccount: provider });
      const votes = await token.get_votes(address);
      setVotingPower(address, BigInt(votes.toString()));
    } catch (e) {
      console.error("get_votes:", e);
    }
  }, [provider, address, setVotingPower]);

  useEffect(() => {
    refreshVotingPower();
  }, [refreshVotingPower]);

  async function handleGetVotingPower() {
    if (!walletWSF || !provider || !address || !chainId) return;
    setErrorMessage(undefined);
    setStep("signing");
    try {
      const token = new Contract({ abi: tokenAbi as Abi, address: TOKEN_ADDRESS, providerOrAccount: provider });
      const nonce = String(await token.nonces(address));
      const expiry = Math.floor(Date.now() / 1000) + DELEGATION_VALIDITY_SEC;
      const typedData = buildDelegationTypedData({ token: TOKEN_ADDRESS, delegatee: address, nonce, expiry, chainId });
      const signature = (await walletWSF.features["starknet:walletApi"].request({
        type: "wallet_signTypedData",
        params: typedData,
      })) as string[];

      setStep("granting");
      const { transactionHash } = await postJson<{ transactionHash: string }>("/api/faucet", {
        address,
        nonce,
        expiry,
        signature,
      });

      setStep("confirming");
      await provider.waitForTransaction(transactionHash);
      setGrant(address, transactionHash);
      await refreshVotingPower();
      setStep("idle");
    } catch (err: unknown) {
      setStep("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  function handleTryAgain() {
    setStep("idle");
    setErrorMessage(undefined);
    refreshVotingPower();
  }

  const hasPower = votingPower !== null && votingPower > 0n;
  const pendingText = step === "idle" || step === "error" ? undefined : PENDING_TEXT[step];

  return (
    <Box border="1px solid" borderColor="#3b4a3b" borderRadius="xl" overflow="hidden" mb={4}>
      <Box
        bg="#1a2e1a"
        px={4}
        py={2}
        fontSize="xs"
        fontWeight="bold"
        letterSpacing="widest"
        textTransform="uppercase"
        color="green.400"
      >
        Voting power
      </Box>
      <Box bg="#111a11" p={5}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Text fontSize="lg" fontWeight="semibold" color="green.400">
            {votingPower === null ? "…" : `${(votingPower / ONE_TOKEN).toLocaleString("en-US")} TTKN`}
          </Text>
          {hasPower ? (
            <Text fontSize="xs" color="gray.500">
              ✓ Ready
            </Text>
          ) : (
            <Button
              size="sm"
              colorPalette="green"
              loading={pendingText !== undefined}
              disabled={votingPower === null || step !== "idle"}
              onClick={handleGetVotingPower}
            >
              Get voting power
            </Button>
          )}
        </Box>
        {!hasPower && votingPower !== null && (step === "idle" || step === "signing") && (
          <DelegationSignatureGuide address={address} />
        )}
        {pendingText && (
          <Text fontSize="sm" color="gray.400" mt={3}>
            {pendingText}
          </Text>
        )}
        {step === "error" && (
          <Box mt={3}>
            <Text fontSize="sm" color="red.400">
              Error: {errorMessage ?? "Unknown error"}
            </Text>
            <Button size="sm" variant="ghost" mt={2} onClick={handleTryAgain}>
              Try again
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}
