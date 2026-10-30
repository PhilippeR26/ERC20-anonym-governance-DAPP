"use client";

import type { ReactNode } from "react";
import { Box, Text } from "@chakra-ui/react";
import { TOKEN_ADDRESS, DELEGATION_VALIDITY_SEC } from "@/app/utils/constants";
import { NETWORK } from "@/app/utils/network";

const DOMAIN_CHAIN = `${NETWORK.chainId} (${NETWORK.walletName})`;

// Wallets shorten long numbers this way (0x68ca…57b3): the guides show that form first, the full value in the details.
const shorten = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

// Wallets label the fields their own way (Ready X writes "Proposal id"): when the raw name differs, the guides give both.
function Field({ shown, raw }: { shown: string; raw?: string }) {
  return (
    <>
      <Text as="span" color="gray.200">
        {shown}
      </Text>
      {raw && (
        <>
          {" ("}
          <Text as="span" fontFamily="mono">
            {raw}
          </Text>
          {")"}
        </>
      )}
    </>
  );
}

function Strong({ children }: { children: ReactNode }) {
  return (
    <Text as="span" fontWeight="semibold" color="gray.200">
      {children}
    </Text>
  );
}

function Value({ children }: { children: ReactNode }) {
  return (
    <Text fontFamily="mono" fontSize="xs" color="gray.500" wordBreak="break-all" ml={3}>
      {children}
    </Text>
  );
}

function Details({ children }: { children: ReactNode }) {
  return (
    <Box as="details" mt={2}>
      <Box as="summary" cursor="pointer" fontSize="sm" color="gray.400">
        Details of the message
      </Box>
      <Box mt={1}>{children}</Box>
    </Box>
  );
}

function ShortenedValues() {
  return (
    <Text fontSize="sm" color="gray.400" mt={1}>
      Your wallet may shorten long values: compare their first and last digits, or open its raw view when it offers
      one.
    </Text>
  );
}

export function VoteSignatureGuide({ proposalId }: { proposalId: string }) {
  return (
    <Box mb={3} p={3} bg="#1a1a2e" borderRadius="lg" border="1px solid" borderColor="#3b3b6b">
      <Text fontSize="sm" fontWeight="semibold" color="gray.200">
        Before you sign
      </Text>
      <Text fontSize="sm" color="gray.400" mt={1}>
        Your wallet will ask you to sign your choice. It is a message, not a transaction: it costs nothing and moves no
        funds. Check two things:
      </Text>
      <Text fontSize="sm" color="gray.400" mt={1}>
        • <Field shown="Support" /> is your choice: <Strong>0</Strong> = Against, <Strong>1</Strong> = For,{" "}
        <Strong>2</Strong> = Abstain
      </Text>
      <Text fontSize="sm" color="gray.400" mt={1}>
        • <Field shown="Proposal id" raw="proposal_id" /> is this proposal, <Strong>{shorten(proposalId)}</Strong>
      </Text>
      <Text fontSize="sm" color="gray.400" mt={2}>
        Approve only if both match. Otherwise reject: nothing is lost.
      </Text>
      <Details>
        <Text fontSize="sm" color="gray.400">
          • The proposal id in full
        </Text>
        <Value>{proposalId}</Value>
        <Text fontSize="sm" color="gray.400" mt={1}>
          • The domain name is <Strong>AnonGovernor</Strong> and the chain id is <Strong>{DOMAIN_CHAIN}</Strong>
        </Text>
        <ShortenedValues />
      </Details>
    </Box>
  );
}

export function DelegationSignatureGuide({ address }: { address: string }) {
  return (
    <Box mt={3}>
      <Text fontSize="sm" fontWeight="semibold" color="gray.200">
        Before you sign
      </Text>
      <Text fontSize="sm" color="gray.400" mt={1}>
        Your tokens only count in a vote once you have activated their voting power. Your wallet will ask you to sign
        a message that activates it for your own address: nobody votes in your place, no token moves and it costs
        nothing. The sponsor account then sends the transaction and pays its fees.
      </Text>
      <Text fontSize="sm" color="gray.400" mt={1}>
        Check one thing: <Strong>Delegatee</Strong> must be your own address, <Strong>{shorten(address)}</Strong>: it
        is the address that will hold the votes. Approve if it matches, otherwise reject: nothing is lost.
      </Text>
      <Details>
        <Text fontSize="sm" color="gray.400">
          • Your address in full
        </Text>
        <Value>{address}</Value>
        <Text fontSize="sm" color="gray.400" mt={1}>
          • <Field shown="Verifying contract" raw="verifying_contract" /> is the voting token (GovToken)
        </Text>
        <Value>{TOKEN_ADDRESS}</Value>
        <Text fontSize="sm" color="gray.400" mt={1}>
          • The domain name is <Strong>GovToken</Strong> and the chain id is <Strong>{DOMAIN_CHAIN}</Strong>
        </Text>
        <Text fontSize="sm" color="gray.400" mt={1}>
          • <Field shown="Nonce" /> and <Field shown="Expiry" /> are technical: a counter, and a Unix time{" "}
          {DELEGATION_VALIDITY_SEC / 60} minutes from now
        </Text>
        <Text fontSize="sm" color="gray.400" mt={1}>
          Technically, the token calls this a delegation (delegate_by_sig): you delegate to yourself, which is why the
          wallet says Delegatee.
        </Text>
        <ShortenedValues />
      </Details>
    </Box>
  );
}
