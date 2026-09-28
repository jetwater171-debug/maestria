import type { Metadata } from "next";
import "./globals.css";
import "./beach.css";

export const metadata: Metadata = {
  title: "Maestria Beach • Sua barraca sob controle",
  description: "Mesas, pedidos, cozinha e caixa conectados.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}

