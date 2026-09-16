import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASTRA — Personal AI Agent Core",
  description:
    "ASTRA is a personal multi-agent AI interface built on the open-source APEX-UI visual foundation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
