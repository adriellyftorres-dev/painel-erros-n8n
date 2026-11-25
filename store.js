import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { matchInstance } from "./config/instances.js";

const DIR = process.env.DATA_DIR || path.join(import.meta.dirname, "data");
const FILE = path.join(DIR, "errors.json");

mkdirSync(DIR, { recursive: true });

// shortcut: JSON em memória, migrar para node:sqlite acima de ~50k erros
let errors = [];
try {
  errors = JSON.parse(readFileSync(FILE, "utf8"));
} catch {
  errors = [];
}

// registros antigos não têm workflowId; deriva do link
for (const e of errors) {
  if (!e.workflowId && e.url) {
    e.workflowId = String(e.url).match(/\/workflow\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
  }
  if (!e.status) e.status = e.done ? "resolved" : "pending";
  if (!Array.isArray(e.history)) e.history = [];
  if (!("urgency" in e)) e.urgency = null;
}

export const STATUSES = ["pending", "analyzing", "fixed", "resolved", "not_fixed"];
// corrigido e resolvido saem da coluna de abertos
const FECHADOS = new Set(["fixed", "resolved"]);

function save() {
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(errors));
  renameSync(tmp, FILE);
}

export function add(input) {
  const text = String(input?.text ?? input?.message ?? "").trim();
  if (!text) return null;

  const instance = input.instance || matchInstance(text);
  const externalId =
    input.externalId ||
    createHash("sha256")
      .update(`${instance}|${text}|${new Date().toISOString().slice(0, 16)}`)
      .digest("hex");

  if (errors.some((e) => e.externalId === externalId)) return null;

  const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
  const item = {
    id: randomUUID(),
    externalId: String(externalId),
    source: input.source || "n8n",
    instance,
    groupId: input.groupId ?? null,
    text,
    workflow: input.workflow || null,
    node: input.node || null,
    errorMsg: input.errorMsg || null,
    tipo: input.tipo || null,
    url: input.url || null,
    sugestao: input.sugestao || null,
    workflowId: input.workflowId || (String(input.url || "").match(/\/workflow\/([A-Za-z0-9_-]+)/)?.[1] ?? null),
    aiSuggestion: null,
    urgency: null,
    createdAt: (Number.isNaN(createdAt.getTime()) ? new Date() : createdAt).toISOString(),
    updatedAt: null,
    status: "pending",
    done: false,
    resolution: null,
    doneAt: null,
    doneBy: null,
    history: [],
  };
  errors.push(item);
  save();
  return item;
}

export function list({ status, q, instance } = {}) {
  const query = String(q || "").toLowerCase();
  return errors
    .filter(
      (e) =>
        (!status ||
          (status === "open" ? !FECHADOS.has(e.status) : status === "done" ? FECHADOS.has(e.status) : e.status === status)) &&
        (!instance || (instance === "__none__" ? !e.instance : e.instance === instance)) &&
        (!query || `${e.text} ${e.instance || ""}`.toLowerCase().includes(query))
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function update(id, { done, status, resolution, by }) {
  const e = errors.find((x) => x.id === id);
  if (!e) return null;

  let novoStatus = status;
  if (!novoStatus && done !== undefined) novoStatus = done ? "resolved" : "pending";
  if (novoStatus && !STATUSES.includes(novoStatus)) novoStatus = e.status;

  const novaResolucao =
    resolution === undefined ? e.resolution : String(resolution ?? "").trim() || null;

  const mudouStatus = novoStatus && novoStatus !== e.status;
  const mudouTexto = novaResolucao !== e.resolution;
  if (mudouStatus || mudouTexto) {
    // guarda o estado anterior antes de sobrescrever
    e.history.push({
      at: new Date().toISOString(),
      by: by || null,
      status: e.status,
      resolution: e.resolution,
    });
    e.updatedAt = new Date().toISOString();
  }

  if (novoStatus) e.status = novoStatus;
  e.resolution = novaResolucao;
  e.done = FECHADOS.has(e.status);
  if (by) e.updatedBy = by;
  if (e.done) {
    e.doneAt = e.doneAt || new Date().toISOString();
    e.doneBy = by || e.doneBy || null;
  } else {
    e.doneAt = null;
    e.doneBy = null;
  }
  save();
  return e;
}

export function atualizarVarios(ids, { status, resolution, by }) {
  const alterados = [];
  for (const id of ids) {
    const e = update(id, { status, resolution, by });
    if (e) alterados.push(e);
  }
  return alterados;
}

export function doDia(dataBRT) {
  return errors.filter((e) => diaBRT(e.createdAt) === dataBRT);
}

// data no fuso de Brasília, formato AAAA-MM-DD
export function diaBRT(iso) {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export function get(id) {
  return errors.find((x) => x.id === id) || null;
}

export function setAi(id, texto, urgencia = null) {
  const e = errors.find((x) => x.id === id);
  if (!e) return null;
  e.aiSuggestion = texto;
  e.urgency = urgencia || null;
  save();
  return e;
}

export function mesmosGrupos(item) {
  return errors.filter(
    (e) =>
      e.workflowId &&
      e.workflowId === item.workflowId &&
      e.node === item.node &&
      e.errorMsg === item.errorMsg
  );
}
