import type { ReactNode } from "react";

import { BackButton } from "@/components/BackButton";
import { Marca } from "@/components/Marca";

/** Moldura das telas fora das 8 etapas da consulta (ex.: prontuários salvos). */
export function TelaSimples({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-ds-5 px-4 pb-ds-7 pt-4 md:px-ds-6 md:pt-ds-5 lg:max-w-4xl">
      <Marca className="text-sm font-semibold tracking-wide text-muted" />
      <header className="flex items-center pr-16">
        <BackButton />
      </header>
      <h1 className="text-3xl font-bold tracking-wide md:text-4xl">{titulo}</h1>
      {children}
    </main>
  );
}
