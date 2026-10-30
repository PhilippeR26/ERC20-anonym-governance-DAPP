"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  Image,
  Portal,
  VStack,
  StackSeparator,
  Text,
} from "@chakra-ui/react";
import { useDisclosure } from "@chakra-ui/react";
import { WalletAccountV6, RpcProvider, validateAndParseAddress } from "starknet";
import { createStore, type Store } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import { useWalletStore } from "@/app/store/walletStore";
import { NETWORK } from "@/app/utils/network";
import { checkCompatibility } from "@/app/utils/walletCompatibility";

const INJECTED_WALLET_POLL_MS = 250; // how often window is checked for a newly injected wallet

// Same colours as the other panels of the page.
const PANEL_BG = "#1a1a2e";
const PANEL_BORDER = "#3b3b6b";

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

  const [wallets, setWallets] = useState<readonly WalletWithStarknetFeatures[]>([]);
  const [verdicts, setVerdicts] = useState<Map<WalletWithStarknetFeatures, boolean>>(new Map()); // no verdict yet = still checking

  async function handleWalletSelected(wallet: WalletWithStarknetFeatures) {
    await wallet.features["standard:connect"].connect({ silent: false });

    const rpcProvider = new RpcProvider({ nodeUrl: "/api/rpc" });

    const wa = await WalletAccountV6.connect(rpcProvider, wallet);

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

  // Wallet discovery, done with the get-starknet-discovery store. A wallet reaches the page in one of three ways:
  // - a window.starknet* object, scanned once when the store is created;
  // - a wallet-standard or EIP-6963 registration, reported to store.subscribe() whenever it happens;
  // - a window.starknet* object injected after that scan, which the store does not report: see the polling below.
  // Every wallet is then tested with wallet_getPermissions and listed as soon as the store reports it.
  useEffect(() => {
    const store: Store = createStore();
    const checkedWallets = new Set<WalletWithStarknetFeatures>(); // wallet objects whose compatibility check was launched
    let cancelled = false;

    const onWalletsChange = (list: readonly WalletWithStarknetFeatures[]) => {
      setWallets(list);
      list
        .filter((wallet) => !checkedWallets.has(wallet))
        .forEach(async (wallet) => {
          checkedWallets.add(wallet);
          const isValid = await checkCompatibility(wallet);
          if (!cancelled) setVerdicts((prev) => new Map(prev).set(wallet, isValid));
        });
    };

    onWalletsChange(store.getWallets()); // wallets already known
    const unsubscribe = store.subscribe(onWalletsChange); // wallets registering later

    // The store scans window.starknet* only once, at creation, and emits nothing when a wallet is injected later.
    // Poll the number of starknet* keys of window and ask the store to scan again when it changes.
    // (A scan re-attaches listeners on every injected wallet, so it is only done when a new key appears.)
    // _refreshInjectedWallets() carries an underscore (not documented), but it is part of the Store type of get-starknet-discovery 6.0.6.
    const countKeys = () => Object.getOwnPropertyNames(window).filter((key) => key.startsWith("starknet")).length;
    let knownCount = countKeys(); // already scanned by createStore()
    const intervalId = setInterval(() => {
      const count = countKeys();
      if (count === knownCount) return;
      knownCount = count;
      store._refreshInjectedWallets();
    }, INJECTED_WALLET_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    onOpen();
  }, [onOpen]);

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
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(2px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg={PANEL_BG}
            borderWidth="1px"
            borderColor={PANEL_BORDER}
            borderRadius="lg"
            boxShadow="2xl"
          >
            <Dialog.Header borderBottomWidth="1px" borderColor={PANEL_BORDER}>
              <Dialog.Title>Select a wallet</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body pt={4}>
              <Text fontSize="sm" color="gray.400" mb={3}>
                Connect a wallet on {NETWORK.walletName}
              </Text>
              <VStack separator={<StackSeparator borderColor={PANEL_BORDER} />} gap={3} mb={4} align="stretch">
                {
                  // The store lists the newest wallet first (get-starknet-discovery 6.0.6): reverse it so that new wallets are added at the bottom and no button moves under the cursor.
                  [...wallets].reverse().map((wallet) => {
                    const isValid = verdicts.get(wallet); // undefined while the check is running
                    const status = isValid === undefined ? " checking..." : isValid ? "" : " not compatible!";
                    return (
                      <Button
                        key={wallet.name}
                        variant="surface"
                        fontSize="lg"
                        fontWeight="bold"
                        backgroundColor={isValid === false ? "orange.700" : undefined}
                        disabled={!isValid}
                        onClick={() => handleWalletSelected(wallet)}
                      >
                        <Image src={wallet.icon} width={30} alt={wallet.name} />
                        {`${wallet.name} ${wallet.features["starknet:walletApi"].walletVersion}${status}`}
                      </Button>
                    );
                  })
                }
              </VStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
