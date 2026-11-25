// Relatório diário em texto pronto para o WhatsApp. Gerado por código, sem IA.
import { doDia } from "./store.js";

const LINHA = "━━━━━━━━━━━━━━━━━━";

const hhmm = (iso) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

const dataBR = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

const titulo = (e) => e.errorMsg || e.workflow || e.text.split("\n")[0];

const bloco = (item) => {
  const linhas = [
    `*${item.n}. ${titulo(item)}*`,
    "",
    `🕒 Identificado às: ${hhmm(item.createdAt)}`,
    "",
  ];
  if (item.workflow && item.workflow !== titulo(item)) linhas.push(`⚙️ Workflow: ${item.workflow}`);
  if (item.node) linhas.push(`🧩 Nó: ${item.node}`);
  if (item.workflow && item.workflow !== titulo(item)) linhas.push("");
  const rotulo = item.resolution ? "🔧 *Correção realizada:*" : "📋 *Situação:*";
  linhas.push(rotulo);
  linhas.push(item.resolution || situacao(item));
  if (item.updatedAt) {
    linhas.push("");
    linhas.push(`_Atualizado em ${dataBR(item.updatedAt)} às ${hhmm(item.updatedAt)}_`);
  }
  return linhas.join("\n");
};

function situacao(item) {
  switch (item.status) {
    case "analyzing":
      return "Ocorrência em investigação. A causa ainda não foi identificada e a correção permanece pendente.";
    case "not_fixed":
      return "Problema não solucionado ou dependente de terceiros. Necessária continuidade da análise.";
    case "fixed":
      return "Correção aplicada, aguardando validação.";
    case "resolved":
      return "Ocorrência corrigida e validada.";
    default:
      return "Problema identificado, mas ainda não corrigido. Necessária continuidade da análise.";
  }
}

export function gerarRelatorio(data) {
  const itens = doDia(data).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const por = (s) => itens.filter((e) => e.status === s);

  const grupos = [
    ["🟢 *ERROS CORRIGIDOS E VALIDADOS*", por("resolved")],
    ["🔵 *CORRIGIDOS AGUARDANDO VALIDAÇÃO*", por("fixed")],
    ["🟡 *ERROS EM ANÁLISE*", por("analyzing")],
    ["⚪ *NÃO CORRIGIDOS*", por("not_fixed")],
    ["🔴 *ERROS PENDENTES*", por("pending")],
  ];

  const total = itens.length;
  const resolvidos = por("resolved").length;

  const partes = [
    "📊 *RELATÓRIO DIÁRIO — ERROS N8N*",
    "",
    `📅 Data: ${dataBR(`${data}T12:00:00-03:00`)}`,
    "",
    LINHA,
    "",
    "📌 *RESUMO DO DIA*",
    "",
    `• Total de ocorrências: ${total}`,
    `• 🟢 Resolvidos: ${resolvidos}`,
    `• 🔵 Corrigidos aguardando validação: ${por("fixed").length}`,
    `• 🟡 Em análise: ${por("analyzing").length}`,
    `• ⚪ Não corrigidos: ${por("not_fixed").length}`,
    `• 🔴 Pendentes: ${por("pending").length}`,
  ];

  if (!total) {
    partes.push("", LINHA, "", "Nenhuma ocorrência registrada nesta data.");
    return partes.join("\n");
  }

  let n = 0;
  for (const [cabecalho, lista] of grupos) {
    if (!lista.length) continue;
    partes.push("", LINHA, "", cabecalho, "");
    for (const item of lista) {
      n++;
      partes.push(bloco({ ...item, n }), "");
    }
  }

  partes.push(
    LINHA,
    "",
    "📈 *FECHAMENTO DO DIA*",
    "",
    `Foram registradas ${total} ocorrência${total > 1 ? "s" : ""} durante o período analisado, sendo ${resolvidos} corrigida${resolvidos === 1 ? "" : "s"} e validada${resolvidos === 1 ? "" : "s"}. As demais permanecem em análise, aguardando validação ou correção.`,
    "",
    `*Status geral:* ${resolvidos} de ${total} ocorrências resolvidas.`
  );

  return partes.join("\n").replace(/\n{3,}/g, "\n\n");
}
