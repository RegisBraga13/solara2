"use client";

import { useRouter } from "next/navigation";

/** Ghost: área de toque 44×44 mínima, seta em SVG. */
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="touch skeu inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md px-3 text-base font-medium text-muted active:translate-y-px md:hover:text-ink"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Voltar
    </button>
  );
}
