import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "erros-ai-"));
const { origem, resumir } = await import("./ai.js");

test("origem descobre instância e workflow pelo link", () => {
  const o = origem({ url: "https://n8n2.eazy.tec.br/workflow/zwZf6BN3hcJxRCVH" });
  assert.equal(o.base, "https://n8n2.eazy.tec.br");
  assert.equal(o.workflowId, "zwZf6BN3hcJxRCVH");
  assert.equal(origem({}), null);
});

test("resumir lista os nós e só detalha o nó que falhou", () => {
  const wf = {
    name: "Teste",
    nodes: [
      { name: "Trigger", type: "n8n-nodes-base.webhook", parameters: { path: "segredo-longo" } },
      { name: "Delete lista", type: "n8n-nodes-base.googleSheets", parameters: { key: "={{ $json.telefone }}" } },
    ],
    connections: { Trigger: { main: [[{ node: "Delete lista" }]] } },
  };
  const txt = resumir(wf, "Delete lista");
  assert.match(txt, /- Trigger \(n8n-nodes-base\.webhook\)/);
  assert.match(txt, /Delete lista.*\n.*parâmetros/);
  assert.match(txt, /Trigger -> Delete lista/);
  assert.ok(!txt.includes("segredo-longo"), "não deve expor parâmetros de outros nós");
});
