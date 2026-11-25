// Importa blocos "🚨 Erro no n8n" de um arquivo de texto para o painel.
// uso: node scripts/import.js data/import-2026-11-25.txt
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { add } from "../store.js";

const file = process.argv[2];
if (!file) {
  console.error("uso: node scripts/import.js <arquivo.txt>");
  process.exit(1);
}

const campo = (bloco, emoji) => {
  const m = bloco.match(new RegExp(`${emoji}\\s*[^:]+:\\s*(.+)`));
  return m ? m[1].trim() : null;
};

const blocks = readFileSync(file, "utf8").split("🚨 Erro no n8n").slice(1);
let created = 0;
let skipped = 0;

for (const b of blocks) {
  const hora = campo(b, "🕐");
  const workflow = campo(b, "⚙️");
  if (!hora || !workflow) {
    skipped++;
    continue;
  }
  const node = campo(b, "🧩");
  const erro = campo(b, "❌");
  const tipo = campo(b, "🏷️");
  const url = campo(b, "🔗");
  const sugestao = campo(b, "💡");

  const [, d, mo, y, h, mi, s] = hora.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/) || [];
  const createdAt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}-03:00`);
  if (Number.isNaN(createdAt.getTime())) {
    skipped++;
    continue;
  }

  const item = add({
    text: [
      `🚨 ${workflow}`,
      `🧩 ${node}`,
      `❌ ${erro}`,
      `🏷️ ${tipo}`,
      `🔗 ${url}`,
      sugestao ? `💡 ${sugestao}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    source: "telegram",
    externalId:
      "msg:" +
      createHash("sha256")
        .update(`${hora}|${workflow}|${node}|${erro}`)
        .digest("hex")
        .slice(0, 16),
    createdAt,
    workflow,
    node: node === "não identificado" ? null : node,
    errorMsg: erro === "sem mensagem" ? null : erro,
    tipo,
    url,
    sugestao,
    groupId: process.env.TG_CHAT_ID || null,
  });
  if (item) created++;
  else skipped++;
}

console.log(`importados: ${created} | ignorados/duplicados: ${skipped}`);
