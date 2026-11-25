// Sugestão de solução por IA (Groq). Somente leitura: nunca altera o n8n.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { api, basesConhecidas } from "./n8n.js";

const GROQ_KEY = process.env.GROQ_API_KEY || "";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const DIR = process.env.DATA_DIR || path.join(import.meta.dirname, "data");
const CACHE_FILE = path.join(DIR, "ai-cache.json");

let cache = {};
try {
  cache = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
} catch {}

function saveCache() {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));
  } catch (e) {
    console.error("ai cache:", e.message);
  }
}

export function origem(item) {
  const m = String(item.url || "").match(/^(https?:\/\/[^/]+).*\/workflow\/([A-Za-z0-9_-]+)/);
  if (m) return { base: m[1], workflowId: m[2] };
  const base = basesConhecidas()[0];
  return base ? { base, workflowId: null } : null;
}

// resumo enxuto do workflow: nomes e tipos, e os parâmetros só do nó que falhou
export function resumir(wf, noAlvo) {
  const nodes = (wf.nodes || []).map((n) => {
    const linha = `- ${n.name} (${n.type})`;
    if (noAlvo && n.name === noAlvo) {
      const params = JSON.stringify(n.parameters || {});
      return `${linha}\n  parâmetros: ${params.slice(0, 1500)}`;
    }
    return linha;
  });
  const conexoes = Object.entries(wf.connections || {})
    .map(([de, v]) => {
      const alvos = Object.values(v).flat().flat().map((c) => c.node).filter(Boolean);
      return alvos.length ? `${de} -> ${[...new Set(alvos)].join(", ")}` : null;
    })
    .filter(Boolean);
  return `Workflow: ${wf.name}\nNós (${nodes.length}):\n${nodes.join("\n")}\n\nConexões:\n${conexoes.join("\n")}`.slice(0, 6000);
}

const SYSTEM = `Você é um engenheiro sênior de automações n8n, especialista em uazapi/WhatsApp, APIs HTTP e tratamento de erro.
Recebe um erro de execução e a estrutura do workflow.
Escreva uma análise curta e prática em português do Brasil, neste formato exato:

**Causa provável:** uma ou duas frases.
**Como resolver:** passos numerados e objetivos, citando o nome do nó.
**Como evitar de novo:** uma ou duas frases sobre retry, tratamento de erro ou validação.

Regras: no máximo 200 palavras. Não invente credenciais nem IDs. Não escreva código longo.
Se a informação for insuficiente, diga o que precisa ser verificado.
Você NÃO executa nada e NÃO altera nada: apenas orienta leitura e correção manual.

Depois da análise, acrescente uma última linha isolada, exatamente neste formato:
URGENCIA: ALTA | MEDIA | BAIXA

Critério da urgência:
ALTA = atendimento parado ou cliente sem resposta: webhook desconectado, instância/bot inativo, erro que se repete dezenas de vezes, venda ou disparo bloqueado.
MEDIA = falha intermitente ou dependência externa instável, com o fluxo ainda operando em parte.
BAIXA = monitoramento/health check, workflow de teste, erro isolado de configuração sem impacto no atendimento.`;

const normalizaUrgencia = (v) => {
  const u = String(v || "").toUpperCase();
  if (u.startsWith("ALTA") || u === "HIGH" || u === "CRITICA" || u === "CRÍTICA") return "alta";
  if (u.startsWith("MEDIA") || u.startsWith("MÉDIA") || u === "MEDIUM") return "media";
  if (u.startsWith("BAIXA") || u === "LOW") return "baixa";
  return null;
};

// separa a linha "URGENCIA: X" do texto que vai para o painel
export function separarUrgencia(texto) {
  const m = String(texto).match(/^\s*URGENCIA:\s*([A-ZÀ-Üa-zà-ü]+).*$/im);
  if (!m) return { texto: String(texto).trim(), urgencia: null };
  return {
    texto: String(texto).replace(m[0], "").replace(/\n{3,}/g, "\n\n").trim(),
    urgencia: normalizaUrgencia(m[1]),
  };
}

const SYSTEM_URG = `Classifique a urgência de um erro de automação n8n.
ALTA = atendimento parado ou cliente sem resposta.
MEDIA = falha intermitente, fluxo ainda operando em parte.
BAIXA = monitoramento, teste ou erro pontual de configuração.
Responda apenas uma palavra: ALTA, MEDIA ou BAIXA.`;

// chamada curta: só a urgência, sem ler o workflow
export async function classificar(item) {
  if (!GROQ_KEY) return null;
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 120,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: SYSTEM_URG },
        {
          role: "user",
          content: `Workflow: ${item.workflow}\nNó: ${item.node}\nErro: ${item.errorMsg || item.text}`.slice(0, 700),
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return separarUrgencia(`URGENCIA: ${j.choices?.[0]?.message?.content || ""}`).urgencia;
}

// transcrição de voz pelo Whisper da Groq (mesma chave)
export async function transcrever(buffer, mimetype = "audio/webm") {
  if (!GROQ_KEY) return { ok: false, motivo: "GROQ_API_KEY não configurada" };
  if (!buffer?.length) return { ok: false, motivo: "áudio vazio" };

  const fd = new FormData();
  const ext = mimetype.includes("wav") ? "wav" : mimetype.includes("mp4") ? "mp4" : "webm";
  fd.append("file", new Blob([buffer], { type: mimetype }), `fala.${ext}`);
  fd.append("model", "whisper-large-v3-turbo");
  fd.append("language", "pt");
  fd.append("response_format", "json");
  fd.append("prompt", "Relato técnico sobre n8n, workflow, webhook, uazapi, WhatsApp e Supabase.");

  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}` },
    body: fd,
    signal: AbortSignal.timeout(120000),
  });

  if (!r.ok) {
    const err = await r.text();
    return { ok: false, motivo: `Whisper ${r.status}: ${err.slice(0, 160)}` };
  }
  const j = await r.json();
  const texto = (j.text || "").trim();
  if (!texto) return { ok: false, motivo: "nada foi reconhecido no áudio" };
  return { ok: true, texto };
}

const SYSTEM_MELHORAR = `Você reescreve o relato de correção de um erro técnico, para virar registro profissional.
Regras obrigatórias:
- Corrija ortografia, pontuação e concordância.
- Linguagem formal, impessoal e objetiva (ex.: "Foi identificada...", "Realizamos...").
- Preserve exatamente o significado: NÃO invente procedimentos, ferramentas, causas nem resultados.
- NÃO afirme que o problema foi resolvido se o relato não disser isso.
- NÃO acrescente informação que não esteja no texto original.
- Entre 30 e 55 palavras quando houver informação suficiente; se faltar, escreva menos.
- Responda apenas o texto final, sem título, sem comentário e sem aspas.`;

// reescreve a descrição da correção; devolve só o texto
export async function melhorar(texto) {
  if (!GROQ_KEY) return { ok: false, motivo: "GROQ_API_KEY não configurada" };
  const original = String(texto || "").trim();
  if (original.length < 10) return { ok: false, motivo: "escreva um pouco mais antes de melhorar" };

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 500,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: SYSTEM_MELHORAR },
        { role: "user", content: original },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!r.ok) {
    const err = await r.text();
    return { ok: false, motivo: `Groq ${r.status}: ${err.slice(0, 160)}` };
  }
  const j = await r.json();
  const novo = j.choices?.[0]?.message?.content?.trim();
  if (!novo) return { ok: false, motivo: "resposta vazia da IA" };
  return { ok: true, texto: novo.replace(/^["“](.*)["”]$/s, "$1").trim() };
}

export async function analisar(item) {
  if (!GROQ_KEY) return { ok: false, motivo: "GROQ_API_KEY não configurada" };

  const chave = `${item.workflowId || item.workflow}|${item.node || ""}|${item.errorMsg || item.text}`;
  if (cache[chave]) {
    const c = cache[chave];
    // entradas antigas guardavam só o texto
    return typeof c === "string"
      ? { ok: true, texto: c, urgencia: null, cache: true }
      : { ok: true, texto: c.texto, urgencia: c.urgencia || null, cache: true };
  }

  let contexto = `Erro no n8n\n\nWorkflow: ${item.workflow || "desconhecido"}\nNó: ${item.node || "não identificado"}\nMensagem: ${item.errorMsg || item.text}`;
  const src = origem(item);
  if (src?.workflowId) {
    try {
      const wf = await api(src.base, `/workflows/${src.workflowId}`);
      contexto += `\n\n${resumir(wf, item.node)}`;
    } catch (e) {
      contexto += `\n\n(não foi possível ler o workflow: ${e.message})`;
    }
  }

  const corpo = JSON.stringify({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 900,
    reasoning_effort: "low",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: contexto },
    ],
  });

  let r;
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_KEY}`, "content-type": "application/json" },
      body: corpo,
      signal: AbortSignal.timeout(60000),
    });
    if (r.status !== 429) break;
    // estourou o limite de tokens por minuto: espera o tempo indicado
    const espera = Number(r.headers.get("retry-after")) * 1000 || 20000;
    if (tentativa < 3) await new Promise((ok) => setTimeout(ok, espera));
  }

  if (!r.ok) {
    const err = await r.text();
    return { ok: false, motivo: `Groq ${r.status}: ${err.slice(0, 200)}` };
  }

  const data = await r.json();
  const bruto = data.choices?.[0]?.message?.content?.trim();
  if (!bruto) return { ok: false, motivo: "resposta vazia da IA" };

  const { texto, urgencia } = separarUrgencia(bruto);
  cache[chave] = { texto, urgencia };
  saveCache();
  return { ok: true, texto, urgencia };
}
