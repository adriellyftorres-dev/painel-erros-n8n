import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "erros-urg-"));
const { separarUrgencia } = await import("./ai.js");

test("extrai a urgência e remove a linha do texto", () => {
  const texto = "**Causa provável:** webhook caído.\n\n**Como resolver:** 1. reconecte.\n\nURGENCIA: ALTA";
  const r = separarUrgencia(texto);
  assert.equal(r.urgencia, "alta");
  assert.ok(!r.texto.includes("URGENCIA"));
  assert.match(r.texto, /Causa provável/);
});

test("aceita MÉDIA com acento e variações de caixa", () => {
  assert.equal(separarUrgencia("texto\nURGENCIA: MÉDIA").urgencia, "media");
  assert.equal(separarUrgencia("texto\nurgencia: baixa").urgencia, "baixa");
});

test("sem a linha, mantém o texto e devolve urgência nula", () => {
  const r = separarUrgencia("apenas a análise, sem linha final");
  assert.equal(r.urgencia, null);
  assert.equal(r.texto, "apenas a análise, sem linha final");
});
