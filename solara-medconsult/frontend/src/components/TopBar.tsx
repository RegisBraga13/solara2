import { Marca } from "@/components/Marca";

/** Barra superior em couro (60px), com semáforo decorativo, a marca ao centro e, com consulta aberta, o nome do paciente. */
export function TopBar({ titulo }: { titulo?: string }) {
  return (
    <div
      className="skeu skeu-leather relative flex h-[60px] items-center rounded-t-xl px-5 text-white shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
      style={{
        background:
          "linear-gradient(180deg, var(--color-leather) 0%, var(--color-leather-dark) 100%)",
      }}
    >
      <div aria-hidden="true" className="flex gap-2">
        {["#E5574B", "#E8B93C", "#5DB05D"].map((c) => (
          <span
            key={c}
            className="h-3 w-3 rounded-full shadow-[inset_0_-1px_2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.5)]"
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-12 flex flex-col items-center leading-tight">
        <Marca couro className="text-lg font-bold tracking-wide" />
        {titulo && <span className="max-w-full truncate text-sm font-semibold opacity-90">{titulo}</span>}
      </div>
    </div>
  );
}
