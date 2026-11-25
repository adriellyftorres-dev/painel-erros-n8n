// Texto do aviso enviado ao grupo, um por status.
export const AVISO_STATUS = {
  pending: { emoji: "🔴", texto: "Voltou para pendente" },
  analyzing: { emoji: "🟡", texto: "Em análise" },
  fixed: { emoji: "🔵", texto: "Corrigido" },
  resolved: { emoji: "🟢", texto: "Resolvido" },
  not_fixed: { emoji: "⚪", texto: "Não corrigido" },
};

export function etiqueta(status) {
  return AVISO_STATUS[status] || AVISO_STATUS.pending;
}

export function mensagemDeStatus(item) {
  const { emoji, texto } = etiqueta(item.status);
  // doneBy só existe em status concluído; updatedBy cobre os demais
  const quem = item.doneBy || item.updatedBy || "painel";
  const onde = [item.workflow, item.node].filter(Boolean).join(" / ");
  const resumo = (item.errorMsg || item.text || "").replace(/\s+/g, " ").trim().slice(0, 300);

  let msg = `${emoji} *${texto}* por ${quem}`;
  if (onde) msg += ` — ${onde}`;
  if (resumo) msg += `:\n- ${resumo}`;
  if (item.resolution) msg += `\n\n➡️ ${item.resolution}`;
  return msg;
}

export function mensagemDeLote(status, quantidade, workflow, resolution, quem) {
  const { emoji, texto } = etiqueta(status);
  return (
    `${emoji} *${texto}* — ${quantidade} ocorrência${quantidade > 1 ? "s" : ""} de ${workflow || "selecionadas"} por ${quem || "painel"}` +
    (resolution ? `\n\n➡️ ${resolution}` : "")
  );
}
