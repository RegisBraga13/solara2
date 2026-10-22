import type { ReactNode } from "react";

import { BackButton } from "@/components/BackButton";
import { Marca } from "@/components/Marca";
import { BarraConsulta } from "@/components/BarraConsulta";

interface TelaProps {
  etapa: number;
  titulo: string;
  children: ReactNode;
}

/** Moldura comum das telas 2–8: voltar, navegação livre, tempo, sair, título e conteúdo (iPad-first). */
export function Tela({ etapa, titulo, children }: TelaProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-ds-5 px-4 pb-ds-7 pt-4 md:px-ds-6 md:pt-ds-5 lg:max-w-4xl">
      <Marca className="text-sm font-semibold tracking-wide text-muted" />
      <header className="flex flex-wrap items-center justify-between gap-x-ds-4 gap-y-1 pr-16">
        <BackButton />
        <BarraConsulta etapa={etapa} />
      </header>
      <h1 className="text-3xl font-bold tracking-wide md:text-4xl">{titulo}</h1>
      {children}
    </main>
  );
}
