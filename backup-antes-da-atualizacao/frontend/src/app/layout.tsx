import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedConsult",
  description: "App de consulta médica — uso exclusivo do médico",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
