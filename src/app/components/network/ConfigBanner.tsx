"use client";

import { useEffect, useState } from "react";
import { Box, Text } from "@chakra-ui/react";
import { checkConfiguration } from "@/app/server/checkConfiguration";

export default function ConfigBanner() {
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    checkConfiguration()
      .then(setProblems)
      .catch(() => setProblems(["Configuration check failed"]));
  }, []);

  if (problems.length === 0) return null;

  return (
    <Box bg="red.950" borderBottom="1px solid" borderColor="red.800" px={5} py={2} fontSize="sm" color="red.400">
      {problems.map((problem) => (
        <Text key={problem}>{problem}</Text>
      ))}
    </Box>
  );
}
