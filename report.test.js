import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "erros-rel-"));
const { add, update, get, list, diaBRT } = await import("./store.js");
const { gerarRelatorio } = await import("./report.js");



test("status corrigido move para fechados sem marcar resolvido", () => {
  const e = add({ text: "erro status", externalId: "s1" });
  const r = update(e.id, { status: "fixed" });
  assert.equal(r.status, "fixed");
  assert.equal(r.done, true);
  assert.ok(list({ status: "open" }).every((x) => x.id !== e.id));
});

test("resolução é preservada e histórico guarda o valor anterior", () => {
  const e = add({ text: "erro hist", externalId: "s2" });
  update(e.id, { status: "analyzing", resolution: "primeira versão" });
  const r = update(e.id, { resolution: "segunda versão" });
  assert.equal(r.resolution, "segunda versão");
  assert.ok(r.history.some((h) => h.resolution === "primeira versão"));
});

test("voltar para pendente limpa a data de conclusão", () => {
  const e = add({ text: "erro volta", externalId: "s3" });
  update(e.id, { status: "resolved" });
  assert.ok(get(e.id).doneAt);
  const r = update(e.id, { status: "pending" });
  assert.equal(r.done, false);
  assert.equal(r.doneAt, null);
});

test("relatório lista as cinco seções e conta o dia", () => {
  const dia = "2024-03-07";
  const a = add({ text: "rel a", externalId: "r1", createdAt: `${dia}T10:00:00-03:00` });
  const b = add({ text: "rel b", externalId: "r2", createdAt: `${dia}T11:00:00-03:00` });
  add({ text: "rel antigo", externalId: "r3", createdAt: "2020-01-01T10:00:00-03:00" });
  update(a.id, { status: "resolved", resolution: "corrigido e validado" });
  update(b.id, { status: "pending" });

  const txt = gerarRelatorio(dia);
  assert.match(txt, /RELATÓRIO DIÁRIO/);
  assert.match(txt, /Total de ocorrências: 2/);
  assert.match(txt, /🟢 \*ERROS CORRIGIDOS E VALIDADOS\*/);
  assert.match(txt, /corrigido e validado/);
  assert.match(txt, /🔴 \*ERROS PENDENTES\*/);
  assert.match(txt, /Status geral:\* 1 de 2/);
  assert.ok(!txt.includes("rel antigo"), "não deve incluir outro dia");
  assert.ok(!txt.includes("\n\n\n"), "sem linhas em branco triplicadas");
});
