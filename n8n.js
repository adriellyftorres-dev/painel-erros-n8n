import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { add } from "./store.js";

const bases = (process.env.N8N_BASE_URL || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
// uma chave para todas, ou uma por instância na mesma ordem
const keys = (process.env.N8N_API_KEY || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const keyFor = (base) => (keys.length === bases.length ? keys[bases.indexOf(base)] : keys[0]) || "";
const DIR = process.env.DATA_DIR || path.join(import.meta.dirname, "data");
const STATE_FILE = path.join(DIR, "n8n-state.json");
const INTERVAL_MS = 60_000;

const state = { lastPoll: null };
try {
  Object.assign(state, JSON.parse(readFileSync(STATE_FILE, "utf8")));
} catch {}

const names = new Map();

function saveState() {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (e) {
    console.error("n8n state:", e.message);
  }
}

// leitura pura: só GET, nada é alterado no n8n
export async function api(base, rota) {
  const r = await fetch(`${base}/api/v1${rota}`, {
    headers: { "X-N8N-API-KEY": keyFor(base), accept: "application/json" },
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error(`${base}${rota} -> ${r.status}`);
  return r.json();
}

export function basesConhecidas() {
  return bases;
}

async function workflowName(base, id) {
  const key = `${base}|${id}`;
  if (names.has(key)) return names.get(key);
  try {
    const wf = await api(base, `/workflows/${id}`);
    names.set(key, wf.name || id);
  } catch {
    names.set(key, null);
  }
  return names.get(key);
}

export function mapExecution(base, exec, wfName) {
  const data = typeof exec.data === "string" ? JSON.parse(exec.data) : exec.data || {};
  const err = data.resultData?.error || {};
  const node = err.node?.name || data.resultData?.lastNodeExecuted || null;
  const message = err.message || err.description || null;
  const started = exec.startedAt || exec.stoppedAt || new Date().toISOString();

  return {
    text: `🚨 ${wfName || exec.workflowId}\n🧩 ${node || "não identificado"}\n❌ ${message || "sem mensagem"}\n🔗 ${base}/workflow/${exec.workflowId}`,
    source: "n8n",
    externalId: `exec:${base}:${exec.id}`,
    createdAt: started,
    workflow: wfName || exec.workflowId,
    node,
    errorMsg: message,
    tipo: err.name || null,
    url: `${base}/workflow/${exec.workflowId}`,
  };
}

async function poll() {
  const after = state.lastPoll ? new Date(state.lastPoll).getTime() : Date.now();
  let newest = after;

  for (const base of bases) {
    let list;
    try {
      list = await api(base, `/executions?status=error&limit=50&includeData=true`);
    } catch (e) {
      console.error("n8n poll:", e.message);
      continue;
    }
    for (const exec of list.data || []) {
      const started = new Date(exec.startedAt || 0).getTime();
      if (!started || started <= after) continue;
      const item = mapExecution(base, exec, await workflowName(base, exec.workflowId));
      if (add(item)) {
        console.log(`+ ${item.workflow} / ${item.node}`);
        newest = Math.max(newest, started);
      }
    }
  }

  state.lastPoll = new Date(newest).toISOString();
  saveState();
}

export function startN8nPolling() {
  if (!bases.length || !keys.length) {
    console.log("coleta n8n desligada (N8N_BASE_URL/N8N_API_KEY)");
    return;
  }
  // primeira execução não importa o passado: hoje já foi importado manualmente
  if (!state.lastPoll) {
    state.lastPoll = new Date().toISOString();
    saveState();
  }
  console.log(`coletando execucoes com erro de ${bases.join(", ")}`);
  (async () => {
    for (;;) {
      try {
        await poll();
      } catch (e) {
        console.error("n8n poll:", e.message);
      }
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  })();
}
