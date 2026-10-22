"use client";

import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "@/lib/api";

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">MedConsult</h1>
      <p className="text-slate-600">Fase 0 — fundação do projeto</p>

      <div className="w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Status do backend</h2>
        {error && <p className="text-red-600">Backend indisponível: {error}</p>}
        {!error && !health && <p className="text-slate-500">Verificando…</p>}
        {health && (
          <ul className="space-y-1 text-sm">
            <li>
              Geral: <strong>{health.status}</strong>
            </li>
            {Object.entries(health.checks).map(([name, value]) => (
              <li key={name}>
                {name}: <strong>{value}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
