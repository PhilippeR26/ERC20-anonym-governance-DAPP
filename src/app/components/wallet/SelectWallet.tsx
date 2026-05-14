"use client";

import { useEffect } from "react";
import {
  Button,
  Dialog,
  Image,
  VStack,
  StackSeparator,
} from "@chakra-ui/react";
import { useDisclosure } from "@chakra-ui/react";
import { WalletAccountV5, RpcProvider, validateAndParseAddress } from "starknet";
import { createStore } from "@starknet-io/get-starknet-discovery";
import {
  isStarknetWallet,
  type WalletWithStarknetFeatures,
} from "@starknet-io/get-starknet-wallet-standard/features";
import { useWalletStore } from "@/app/store/walletStore";

export default function SelectWallet() {
  const { open, onOpen, onClose } = useDisclosure();
  const {
    setConnected,
    setAddress,
    setChainId,
    setWalletAccount,
    setProvider,
    setWalletWSF,
    setDisplaySelectWalletUI,
  } = useWalletStore();

  const store = createStore();
  const wallets = store.getWallets().filter(isStarknetWallet);

  async function handleWalletSelected(wallet: WalletWithStarknetFeatures) {
    await wallet.features["standard:connect"].connect({ silent: false });

    const rpcProvider = new RpcProvider({ nodeUrl: "/api/rpc" });

    const wa = await WalletAccountV5.connect(rpcProvider, wallet);

    const accounts = (await wallet.features["starknet:walletApi"].request({
      type: "wallet_requestAccounts",
    })) as string[];
    const address = validateAndParseAddress(accounts[0]);

    const chainId = (await wallet.features["starknet:walletApi"].request({
      type: "wallet_requestChainId",
    })) as string;

    setWalletAccount(wa);
    setProvider(rpcProvider);
    setWalletWSF(wallet);
    setAddress(address);
    setChainId(chainId);
    setConnected(true);
    setDisplaySelectWalletUI(false);
    onClose();
  }

  useEffect(() => {
    onOpen();
  }, []);

  return (
    <Dialog.Root
      placement="center"
      open={open}
      closeOnInteractOutside
      onOpenChange={() => {
        setDisplaySelectWalletUI(false);
        onClose();
      }}
    >
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Select a wallet</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <VStack separator={<StackSeparator />} gap={3} mb={4} align="stretch">
              {wallets.map((wallet, i) => (
                <Button
                  key={i}
                  variant="surface"
                  fontSize="lg"
                  fontWeight="bold"
                  onClick={() => handleWalletSelected(wallet)}
                >
                  <Image src={wallet.icon} width={30} alt={wallet.name} />
                  {wallet.name}
                </Button>
              ))}
            </VStack>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
