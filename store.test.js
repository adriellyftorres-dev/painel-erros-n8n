import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "erros-"));
const { add, list, update } = await import("./store.js");

test("add ignora texto vazio e deduplica externalId", () => {
  assert.equal(add({ text: "  " }), null);
  const a = add({ text: "erro X", externalId: "1" });
  assert.ok(a);
  assert.equal(add({ text: "erro X", externalId: "1" }), null);
});

test("instância é inferida pelo nome no texto", () => {
  const e = add({ text: "falha ao enviar em 19 MOTORS", externalId: "2" });
  assert.equal(e.instance, "19 MOTORS");
});

test("update marca concluído com data e filtro por status", () => {
  const pendingBefore = list({ status: "pending" }).length;
  const e = add({ text: "erro Y", externalId: "3" });
  const done = update(e.id, { done: true, resolution: "reiniciei", by: "admin" });
  assert.equal(done.done, true);
  assert.ok(done.doneAt);
  assert.equal(done.doneBy, "admin");
  assert.equal(list({ status: "pending" }).length, pendingBefore);
  assert.equal(list({ status: "done" }).length, 1);

  update(e.id, { done: false });
  assert.equal(list({ status: "pending" }).length, pendingBefore + 1);
});
