/** Cartão decorativo afundado com mini gráfico de linha (sem dados reais). */
export function ChartCard({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`skeu rounded-lg bg-sunken p-4 shadow-sunken ${className}`}
    >
      <svg viewBox="0 0 200 60" className="h-16 w-full" preserveAspectRatio="none" fill="none">
        <path
          d="M0 44 C 20 40, 30 20, 50 26 S 80 50, 100 34 S 140 8, 160 22 S 190 30, 200 14"
          stroke="var(--color-terracotta)"
          strokeWidth="3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
