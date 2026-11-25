// Classifica a urgência dos erros que já têm sugestão mas ainda não têm urgência.
// Uso: node --env-file=.env scripts/reclassificar.js
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { classificar } from "../ai.js";

const DIR = process.env.DATA_DIR || path.join(import.meta.dirname, "..", "data");
const FILE = path.join(DIR, "errors.json");
const erros = JSON.parse(readFileSync(FILE, "utf8"));

const grupos = new Map();
for (const e of erros) {
  if (e.urgency) continue;
  const chave = `${e.workflowId || e.workflow}|${e.node}|${e.errorMsg || e.text}`;
  if (!grupos.has(chave)) grupos.set(chave, []);
  grupos.get(chave).push(e);
}

console.log(`${grupos.size} grupos únicos para classificar (${erros.filter((e) => !e.urgency).length} ocorrências)`);

let n = 0;
for (const [chave, itens] of grupos) {
  const u = await classificar(itens[0]);
  if (u) {
    for (const e of itens) e.urgency = u;
    n++;
    console.log(`${u.padEnd(6)} ${itens[0].workflow} / ${itens[0].node} (${itens.length}x)`);
  } else {
    console.log(`falhou  ${itens[0].workflow} / ${itens[0].node}`);
  }
  writeFileSync(FILE, JSON.stringify(erros));
  await new Promise((ok) => setTimeout(ok, 2500));
}
console.log(`classificados: ${n}/${grupos.size}`);
