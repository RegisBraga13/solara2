import type { Metadata, Viewport } from "next";

import { Providers } from "@/components/Providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "espec·IA·lidades",
  description: "Plataforma de consultas médicas com IA por especialidade — uso exclusivo do médico",
  applicationName: "espec·IA·lidades",
};

// iPad/PWA: sem zoom por pinça (como especificado) e área segura (notch/barra inferior).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#EFEAE2",
};

// Define o tema (classe day/night) antes da primeira pintura, evitando piscar:
// usa o rascunho salvo ou, sem ele, a hora do dia (6h–18h = dia).
const temaInicial = `(function(){var d=document.documentElement;try{var t=null;var s=localStorage.getItem("medconsult-state");if(s){var j=JSON.parse(s);t=j&&j.state&&j.state.theme}if(t!=="dia"&&t!=="noite"){var h=new Date().getHours();t=h>=6&&h<18?"dia":"noite"}d.classList.remove("day","night");d.classList.add(t==="noite"?"night":"day")}catch(e){d.classList.add("day")}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="day" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="especIA" />
        <meta name="application-name" content="espec·IA·lidades" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script dangerouslySetInnerHTML={{ __html: temaInicial }} />
      </head>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
