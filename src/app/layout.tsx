import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RelanceDevis AI — Relancez vos devis automatiquement",
  description:
    "Le logiciel qui relance vos devis à votre place. Pour les artisans et petites entreprises du bâtiment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
