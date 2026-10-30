"use client";

import { Badge } from "@chakra-ui/react";
import { NETWORK } from "@/app/utils/network";

export default function NetworkBadge() {
  return (
    <Badge colorPalette={NETWORK.name === "mainnet" ? "green" : "orange"} variant="subtle" size="md" ml={3}>
      {NETWORK.badgeLabel}
    </Badge>
  );
}
