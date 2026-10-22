"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AvisoDialog } from "@/components/AvisoDialog";
import { BigButton } from "@/components/BigButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Panel } from "@/components/Panel";
import { TelaSimples } from "@/components/TelaSimples";
import {
  baixarPdfProntuario,
  corrigirProntuario,
  excluirProntuario,
  obterProntuario,
  urlLaudo,
  urlPdfProntuario,
  type ProntuarioCompleto,
} from "@/lib/api";
import { formatarData } from "@/lib/datas";
import { compartilharPdf, criarPdfProntuario } from "@/lib/pdf";

export default function ProntuarioSalvoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<ProntuarioCompleto | null>(null);
  const [erro, setErro] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    obterProntuario(id)
      .then((r) => {
        setP(r);
        if (new URLSearchParams(window.location.search).get("editar") === "1") {
          setRascunho(r.texto);
          setEditando(true);
        }
      })
      .catch(() => setErro(true));
  }, [id]);

  async function salvarCorrecao() {
    if (!p || salvando) return;
    if (!rascunho.trim()) {
      setAviso("O prontuário não pode ficar vazio.");
      return;
    }
    setSalvando(true);
    try {
      const arquivo = await criarPdfProntuario({ texto: rascunho, paciente: p.paciente, geradoEm: new Date() });
      await corrigirProntuario(id, { texto: rascunho, pdf: arquivo.blob, nomePdf: arquivo.nome });
      setP(await obterProntuario(id));
      setEditando(false);
    } catch {
      setAviso("Não foi possível salvar a correção agora. Nada foi alterado.");
    } finally {
      setSalvando(false);
    }
  }

  async function compartilhar() {
    try {
      const blob = await baixarPdfProntuario(id);
      await compartilharPdf(blob, `prontuario-${id.slice(0, 8)}.pdf`);
    } catch {
      setAviso("Não foi possível obter o PDF agora. Tente novamente.");
    }
  }

  async function apagar() {
    setApagando(false);
    try {
      await excluirProntuario(id);
      router.replace("/prontuarios");
    } catch {
      setAviso("Não foi possível excluir agora. Tente novamente.");
    }
  }

  return (
    <TelaSimples titulo={p ? p.paciente || "Sem nome" : "PRONTUÁRIO"}>
      {erro && (
        <p role="alert" className="rounded-xl bg-sunken p-ds-4 text-base font-semibold">
          ⚠️ Prontuário não encontrado ou servidor indisponível.
        </p>
      )}
      {p && (
        <>
          <p className="text-base text-muted">
            {formatarData(p.criado_em)}
            {p.modo ? ` · ${p.modo}` : ""}
          </p>
          {editando ? (
            <Panel className="flex flex-col gap-ds-3">
              <label className="flex flex-col gap-2">
                <span className="text-base font-semibold">Corrigir o texto do prontuário</span>
                <textarea
                  value={rascunho}
                  rows={22}
                  maxLength={100000}
                  onChange={(e) => setRascunho(e.target.value)}
                  className="input-sunken font-sans text-lg"
                />
              </label>
              <p className="text-sm text-muted">O PDF é refeito com o texto corrigido. A data e o tipo do registro não mudam.</p>
              <div className="grid grid-cols-1 gap-ds-3 md:grid-cols-2">
                <BigButton disabled={salvando} onClick={salvarCorrecao}>
                  {salvando ? "SALVANDO…" : "SALVAR CORREÇÃO"}
                </BigButton>
                <BigButton variant="secondary" disabled={salvando} onClick={() => setEditando(false)}>
                  CANCELAR
                </BigButton>
              </div>
            </Panel>
          ) : (
            <Panel>
              <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed">{p.texto}</pre>
            </Panel>
          )}
          {(p.laudos ?? []).length > 0 && (
            <Panel className="flex flex-col gap-ds-2">
              <h2 className="text-xl font-bold tracking-wide">LAUDOS ANEXADOS</h2>
              {(p.laudos ?? []).map((l) => (
                <a key={l.id} href={urlLaudo(l.id)} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold underline">
                  📎 {l.nome}
                </a>
              ))}
            </Panel>
          )}
          {!editando && (
            <BigButton
              variant="secondary"
              onClick={() => {
                setRascunho(p.texto);
                setEditando(true);
              }}
            >
              EDITAR (CORRIGIR ERROS)
            </BigButton>
          )}
          <div className="grid grid-cols-1 gap-ds-4 md:grid-cols-2 md:gap-ds-5">
            <BigButton onClick={() => window.open(urlPdfProntuario(id), "_blank", "noopener")}>
              ABRIR PDF
            </BigButton>
            <BigButton variant="secondary" onClick={compartilhar}>
              COMPARTILHAR / SALVAR EM ARQUIVOS
            </BigButton>
          </div>
          <BigButton variant="secondary" onClick={() => setApagando(true)}>
            EXCLUIR PRONTUÁRIO
          </BigButton>
        </>
      )}
      <ConfirmDialog
        aberto={apagando}
        mensagem="Excluir este prontuário e o PDF? Não dá para desfazer."
        onConfirmar={apagar}
        onCancelar={() => setApagando(false)}
      />
      <AvisoDialog mensagem={aviso} onOk={() => setAviso(null)} />
    </TelaSimples>
  );
}
