"use client";

import { MotionConfig } from "framer-motion";
import { useEffect, type ReactNode } from "react";

import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePersist } from "@/hooks/usePersist";
import { classeDoTema } from "@/lib/tema";
import { useConsulta } from "@/store/consulta";

function ThemeSync() {
  const hidratado = usePersist();
  const theme = useConsulta((s) => s.theme);
  useEffect(() => {
    if (!hidratado) return;
    const el = document.documentElement;
    el.classList.remove("day", "night");
    el.classList.add(classeDoTema(theme));
  }, [hidratado, theme]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeSync />
      <ServiceWorkerRegister />
      <ThemeToggle />
      {children}
    </MotionConfig>
  );
}
