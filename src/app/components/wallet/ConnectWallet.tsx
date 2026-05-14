"use client";

import { Button } from "@chakra-ui/react";
import { useWalletStore } from "@/app/store/walletStore";
import SelectWallet from "./SelectWallet";

export default function ConnectWallet() {
  const {
    isConnected,
    address,
    displaySelectWalletUI,
    setDisplaySelectWalletUI,
    disconnect,
  } = useWalletStore();

  if (isConnected) {
    return (
      <Button variant="surface" size="sm" px={4} bg="purple.700" onClick={disconnect}>
        {address ? `${address.slice(0, 6)}…${address.slice(-4)} ▾` : "Connected"}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="surface"
        size="sm"
        px={4}
        bg="purple.700"
        onClick={() => setDisplaySelectWalletUI(true)}
      >
        Connect Wallet
      </Button>
      {displaySelectWalletUI && <SelectWallet />}
    </>
  );
}
