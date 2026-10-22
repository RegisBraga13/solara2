"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AvisoDialog } from "@/components/AvisoDialog";
import { BigButton } from "@/components/BigButton";
import { Panel } from "@/components/Panel";
import { TelaSimples } from "@/components/TelaSimples";
import { emitirReceita, obterPaciente, urlPdfReceita } from "@/lib/api";
import { guardarMedico, lerMedico, medicoValido, MEDICO_VAZIO, type Medico } from "@/lib/medico";
import { compartilharPdf } from "@/lib/pdf";
import { criarPdfReceita } from "@/lib/pdfReceita";
import {
  ITEM_VAZIO,
  MAX_ITENS,
  itensPreenchidos,
  temItemIncompleto,
  type ItemReceita,
} from "@/lib/receita";

const CAMPOS_ITEM: { campo: keyof ItemReceita; rotulo: string }[] = [
  { campo: "medicamento", rotulo: "Medicamento (nome e concentração)" },
  { campo: "posologia", rotulo: "Posologia (como usar)" },
  { campo: "duracao", rotulo: "Duração (opcional)" },
  { campo: "quantidade", rotulo: "Quantidade (opcional)" },
];

/** Receita preenchida à mão pelo médico. Nada é sugerido ou preenchido pela IA. */
export default function ReceitaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [paciente, setPaciente] = useState<string | null>(null);
  const [medico, setMedico] = useState<Medico>(MEDICO_VAZIO);
  const [itens, setItens] = useState<ItemReceita[]>([{ ...ITEM_VAZIO }]);
  const [observacoes, setObservacoes] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [emitida, setEmitida] = useState<{ id: string; blob: Blob; nome: string } | null>(null);

  useEffect(() => {
    setMedico(lerMedico());
    obterPaciente(id)
      .then((p) => setPaciente(p.nome))
      .catch(() => setAviso("Paciente não encontrado ou servidor indisponível."));
  }, [id]);

  const mudarItem = (i: number, campo: keyof ItemReceita, valor: string) =>
    setItens((l) => l.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  async function emitir() {
    if (ocupado || paciente === null) return;
    if (!medicoValido(medico)) {
      setAviso("Informe o seu nome e o CRM (com a UF) para emitir a receita.");
      return;
    }
    if (temItemIncompleto(itens)) {
      setAviso("Há medicamento sem posologia (ou posologia sem medicamento). Complete ou apague a linha.");
      return;
    }
    const prontos = itensPreenchidos(itens);
    if (prontos.length === 0) {
      setAviso("Inclua ao menos um medicamento com a posologia.");
      return;
    }
    setOcupado(true);
    try {
      guardarMedico(medico);
      const arquivo = await criarPdfReceita({
        medico,
        paciente,
        itens: prontos,
        observacoes,
        emitidaEm: new Date(),
      });
      const r = await emitirReceita({
        pacienteId: id,
        itens: prontos,
        observacoes: observacoes.trim(),
        medicoNome: medico.nome.trim(),
        medicoCrm: medico.crm.trim(),
        pdf: arquivo.blob,
        nomePdf: arquivo.nome,
      });
      setEmitida({ id: r.id, ...arquivo });
    } catch {
      setAviso("Não foi possível emitir a receita agora. Nada foi enviado: confira os dados e tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  if (emitida) {
    return (
      <TelaSimples titulo="RECEITA EMITIDA">
        <Panel className="flex flex-col gap-ds-3">
          <p className="text-lg">✅ Receita salva no prontuário de {paciente}.</p>
          <p className="text-base text-muted">
            Documento de apoio sem assinatura digital ICP-Brasil. Receita de medicamento controlado exige
            sistema próprio com certificado.
          </p>
        </Panel>
        <BigButton onClick={() => window.open(urlPdfReceita(emitida.id), "_blank", "noopener")}>
          ABRIR PDF
        </BigButton>
        <BigButton variant="secondary" onClick={() => void compartilharPdf(emitida.blob, emitida.nome)}>
          COMPARTILHAR / SALVAR PDF NO APARELHO
        </BigButton>
        <BigButton variant="secondary" onClick={() => router.push(`/pacientes/${id}`)}>
          VOLTAR AO PRONTUÁRIO DO PACIENTE
        </BigButton>
      </TelaSimples>
    );
  }

  return (
    <TelaSimples titulo="NOVA RECEITA">
      <p role="note" className="rounded-xl bg-sunken p-ds-4 text-base font-semibold">
        Receita preenchida por você: nada é sugerido nem gerado pela IA. Confira nome, dose e posologia
        antes de emitir; o documento não pode ser editado depois (para corrigir, emita outra).
      </p>
      <p className="text-lg">
        Paciente: <strong>{paciente ?? "…"}</strong>
      </p>

      <Panel className="flex flex-col gap-ds-3">
        <h2 className="text-xl font-bold tracking-wide">MÉDICO</h2>
        <label className="flex flex-col gap-2">
          <span className="text-base font-semibold">Nome</span>
          <input
            value={medico.nome}
            maxLength={120}
            onChange={(e) => setMedico((m) => ({ ...m, nome: e.target.value }))}
            className="input-sunken min-h-[52px]"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-base font-semibold">CRM e UF (ex.: CRM 12345/SP)</span>
          <input
            value={medico.crm}
            maxLength={40}
            onChange={(e) => setMedico((m) => ({ ...m, crm: e.target.value }))}
            className="input-sunken min-h-[52px]"
          />
        </label>
        <p className="text-sm text-muted">Fica salvo só neste aparelho.</p>
      </Panel>

      {itens.map((item, i) => (
        <Panel key={i} className="flex flex-col gap-ds-3">
          <h2 className="text-xl font-bold tracking-wide">ITEM {i + 1}</h2>
          {CAMPOS_ITEM.map(({ campo, rotulo }) => (
            <label key={campo} className="flex flex-col gap-2">
              <span className="text-base font-semibold">{rotulo}</span>
              {campo === "posologia" ? (
                <textarea
                  value={item[campo]}
                  rows={2}
                  maxLength={500}
                  onChange={(e) => mudarItem(i, campo, e.target.value)}
                  className="input-sunken"
                />
              ) : (
                <input
                  value={item[campo]}
                  maxLength={campo === "medicamento" ? 200 : 100}
                  onChange={(e) => mudarItem(i, campo, e.target.value)}
                  className="input-sunken min-h-[52px]"
                />
              )}
            </label>
          ))}
          {itens.length > 1 && (
            <BigButton variant="secondary" onClick={() => setItens((l) => l.filter((_, j) => j !== i))}>
              REMOVER ITEM {i + 1}
            </BigButton>
          )}
        </Panel>
      ))}
      {itens.length < MAX_ITENS && (
        <BigButton variant="secondary" onClick={() => setItens((l) => [...l, { ...ITEM_VAZIO }])}>
          + ADICIONAR MEDICAMENTO
        </BigButton>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-base font-semibold">Observações (opcional)</span>
        <textarea
          value={observacoes}
          rows={3}
          maxLength={2000}
          onChange={(e) => setObservacoes(e.target.value)}
          className="input-sunken"
        />
      </label>

      <BigButton disabled={ocupado || paciente === null} onClick={emitir}>
        {ocupado ? "EMITINDO…" : "EMITIR RECEITA (PDF)"}
      </BigButton>
      <AvisoDialog mensagem={aviso} onOk={() => setAviso(null)} />
    </TelaSimples>
  );
}
