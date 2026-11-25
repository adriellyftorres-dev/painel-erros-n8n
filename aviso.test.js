import { test } from "node:test";
import assert from "node:assert/strict";
import { mensagemDeStatus, mensagemDeLote } from "./aviso.js";

const base = {
  workflow: "IA MW VEICULOS",
  node: "REMOVE DUPLICATAS",
  errorMsg: "'telefone' field is missing",
  resolution: "Corrigi o nó",
  doneBy: "admin",
};

test("cada status tem sua própria etiqueta na mensagem", () => {
  const esperado = {
    pending: "🔴 *Voltou para pendente*",
    analyzing: "🟡 *Em análise*",
    fixed: "🔵 *Corrigido*",
    resolved: "🟢 *Resolvido*",
    not_fixed: "⚪ *Não corrigido*",
  };
  for (const [status, inicio] of Object.entries(esperado)) {
    const msg = mensagemDeStatus({ ...base, status });
    assert.ok(msg.startsWith(inicio), `${status} começou com "${msg.slice(0, 30)}"`);
    assert.ok(!msg.includes("✅"), `${status} não deve usar o check genérico`);
  }
});

test("em análise nunca diz resolvido", () => {
  const msg = mensagemDeStatus({ ...base, status: "analyzing", doneBy: null, updatedBy: "admin" });
  assert.ok(!/resolvido/i.test(msg), msg);
  assert.match(msg, /\*Em análise\* por admin/);
  assert.match(msg, /IA MW VEICULOS \/ REMOVE DUPLICATAS/);
  assert.match(msg, /➡️ Corrigi o nó/);
});

test("status não concluído usa updatedBy em vez de por null", () => {
  const msg = mensagemDeStatus({ ...base, status: "analyzing", doneBy: null, updatedBy: "admin" });
  assert.ok(!msg.includes("null"), msg);
});

test("formato: erro em linha própria e descrição separada por linha em branco", () => {
  const msg = mensagemDeStatus({
    ...base,
    status: "analyzing",
    resolution: "A análise será realizada com o Felipe.",
  });
  assert.match(msg, /:\n- 'telefone' field is missing/);
  assert.match(msg, /\n\n➡️ A análise será realizada com o Felipe\.$/);
});

test("sem descrição não mostra a seta", () => {
  const msg = mensagemDeStatus({ ...base, status: "pending", resolution: null });
  assert.ok(!msg.includes("➡️"));
});

test("lote usa a etiqueta do status e o plural certo", () => {
  assert.match(mensagemDeLote("resolved", 15, "JOTAP", "Supabase instável", "admin"), /🟢 \*Resolvido\* — 15 ocorrências de JOTAP por admin/);
  assert.match(mensagemDeLote("analyzing", 1, "X", null, "admin"), /🟡 \*Em análise\* — 1 ocorrência de X por admin/);
  assert.match(mensagemDeLote("analyzing", 1, "X", "detalhe", "admin"), /\n\n➡️ detalhe$/);
});
