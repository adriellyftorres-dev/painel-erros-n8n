import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "erros-n8n-"));
const { mapExecution } = await import("./n8n.js");

test("mapExecution extrai workflow, nó e erro da execução", () => {
  const exec = {
    id: "77",
    workflowId: "zwZf6BN3hcJxRCVH",
    startedAt: "2026-11-25T04:44:07.000Z",
    data: {
      resultData: {
        lastNodeExecuted: "Delete lista",
        error: { name: "NodeOperationError", message: "Node 'Bot inativo ?' hasn't been executed" },
      },
    },
  };
  const item = mapExecution("https://n8n2.eazy.tec.br", exec, "IA MAIA - JOTAP");
  assert.equal(item.workflow, "IA MAIA - JOTAP");
  assert.equal(item.node, "Delete lista");
  assert.equal(item.errorMsg, "Node 'Bot inativo ?' hasn't been executed");
  assert.equal(item.externalId, "exec:https://n8n2.eazy.tec.br:77");
  assert.equal(item.url, "https://n8n2.eazy.tec.br/workflow/zwZf6BN3hcJxRCVH");
});

test("mapExecution lida com execução sem erro detalhado", () => {
  const item = mapExecution("https://n8n.eazy.tec.br", { id: "1", workflowId: "abc" }, null);
  assert.equal(item.node, null);
  assert.equal(item.errorMsg, null);
  assert.match(item.text, /sem mensagem/);
});
