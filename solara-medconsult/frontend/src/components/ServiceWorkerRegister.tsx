"use client";

import { useEffect } from "react";

/** Registra o service worker (só em produção, para não atrapalhar o `next dev`). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sem service worker o app continua funcionando normalmente (só não fica offline).
    });
  }, []);
  return null;
}
