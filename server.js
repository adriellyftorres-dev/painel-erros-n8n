import express from "express";
import path from "node:path";
import { add, list, update, get, setAi, mesmosGrupos, atualizarVarios, diaBRT } from "./store.js";
import { startPolling } from "./telegram.js";
import { startN8nPolling } from "./n8n.js";
import { analisar, melhorar, transcrever } from "./ai.js";
import { gerarRelatorio } from "./report.js";
import { mensagemDeStatus, mensagemDeLote } from "./aviso.js";

const PORT = Number(process.env.PORT) || 3400;
const API_KEY = process.env.API_KEY || "";
const [USER, PASS] = (process.env.BASIC_AUTH || "admin:admin").split(":");
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TG_CHAT_ID || "";

const app = express();
app.use(express.json({ limit: "1mb" }));
// áudio gravado no navegador é enviado cru no corpo
app.use("/api/transcribe", express.raw({ type: ["audio/*", "video/webm", "application/octet-stream"], limit: "26mb" }));

app.use((req, res, next) => {
  if (API_KEY && req.get("x-api-key") === API_KEY) return next();
  const [scheme, token] = (req.get("authorization") || "").split(" ");
  if (scheme === "Basic") {
    const [u, p] = Buffer.from(token || "", "base64").toString().split(":");
    if (u === USER && p === PASS) {
      req.user = u;
      return next();
    }
  }
  res.set("WWW-Authenticate", 'Basic realm="erros"').status(401).send("Acesso restrito");
});

app.use(express.static(path.join(import.meta.dirname, "public")));

app.get("/api/errors", (req, res) => res.json(list(req.query)));

app.post("/api/errors", (req, res) => {
  const body = Array.isArray(req.body) ? req.body : [req.body];
  const created = body.map(add).filter(Boolean);
  res.json({ received: body.length, created: created.length });
});

// um aviso por status, com a etiqueta certa
app.patch("/api/errors/:id", async (req, res) => {
  const { done, status, resolution } = req.body || {};
  // cópia antes: update() altera o mesmo objeto
  const atual = get(req.params.id);
  const antes = atual ? JSON.parse(JSON.stringify(atual)) : null;
  const item = update(req.params.id, { done, status, resolution, by: req.user || "api" });
  if (!item) return res.status(404).json({ error: "não encontrado" });

  const statusMudou = antes?.status !== item.status;
  const textoMudou = antes?.resolution !== item.resolution;

  if (statusMudou || textoMudou) await notify(mensagemDeStatus(item));
  res.json(item);
});

// fecha vários de uma vez e manda um único aviso no grupo
app.post("/api/errors/bulk", async (req, res) => {
  const { ids, workflow, data, status = "resolved", resolution } = req.body || {};
  let alvos = [];

  if (Array.isArray(ids) && ids.length) {
    alvos = ids.map(get).filter(Boolean);
  } else if (workflow) {
    alvos = list({}).filter(
      (e) =>
        (e.workflow || "") === workflow &&
        (!data || diaBRT(e.createdAt) === data) &&
        !e.done
    );
  }

  if (!alvos.length) return res.json({ alterados: 0 });
  const alterados = atualizarVarios(
    alvos.map((e) => e.id),
    { status, resolution, by: req.user || "api" }
  );

  await notify(mensagemDeLote(status, alterados.length, workflow, resolution, req.user || "api"));
  res.json({ alterados: alterados.length });
});

app.post("/api/errors/:id/improve", async (req, res) => {
  const r = await melhorar(req.body?.texto || "");
  if (!r.ok) return res.status(502).json({ error: r.motivo });
  res.json({ ok: true, texto: r.texto });
});

app.post("/api/transcribe", async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    return res.status(400).json({ error: "nenhum áudio recebido" });
  }
  const r = await transcrever(req.body, req.get("content-type") || "audio/webm");
  if (!r.ok) return res.status(502).json({ error: r.motivo });
  res.json({ ok: true, texto: r.texto });
});

app.get("/api/report", (req, res) => {
  const data = req.query.date || diaBRT(new Date().toISOString());
  res.json({ data, texto: gerarRelatorio(data) });
});

async function analisarItem(item) {
  const r = await analisar(item);
  if (r.ok) {
    // a mesma falha no mesmo nó recebe a mesma orientação
    setAi(item.id, r.texto, r.urgencia);
    for (const igual of mesmosGrupos(item)) setAi(igual.id, r.texto, r.urgencia);
  }
  return r;
}

app.post("/api/errors/:id/analyze", async (req, res) => {
  const item = get(req.params.id);
  if (!item) return res.status(404).json({ error: "não encontrado" });
  const r = await analisarItem(item);
  if (!r.ok) return res.status(502).json({ error: r.motivo });
  res.json({ ok: true, texto: r.texto, urgencia: r.urgencia });
});

let analisando = false;

app.post("/api/analyze-all", async (req, res) => {
  if (analisando) return res.status(409).json({ error: "análise já em andamento" });
  analisando = true;
  const feitos = [];
  const falhas = [];
  try {
    for (const item of list({ status: "pending" })) {
      if (item.aiSuggestion) continue;
      const r = await analisarItem(item);
      if (r.ok) feitos.push(item.id);
      else falhas.push(`${item.workflow}: ${r.motivo}`);
    }
  } finally {
    analisando = false;
  }
  res.json({ analisados: feitos.length, falhas });
});

async function notify(text) {
  if (!BOT_TOKEN || !TG_CHAT_ID) return;
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text }),
    });
    if (!r.ok) console.error("telegram:", r.status, (await r.text()).slice(0, 200));
    else console.log("telegram: aviso enviado\n" + text);
  } catch (e) {
    console.error("telegram:", e.message);
  }
}

app.listen(PORT, "127.0.0.1", () => console.log(`painel em http://127.0.0.1:${PORT}`));
startPolling();
startN8nPolling();
