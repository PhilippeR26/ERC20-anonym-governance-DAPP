import type { Metadata } from "next";
import { Provider } from "@/components/ui/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anon Governance Demo",
  description: "ERC20 anonymous governance on Starknet Mainnet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
