import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { add } from "./store.js";

const token = process.env.BOT_TOKEN;
const chatId = Number(process.env.TG_CHAT_ID) || null;
const DIR = process.env.DATA_DIR || path.join(import.meta.dirname, "data");
const OFFSET_FILE = path.join(DIR, "tg-offset.json");

let offset = 0;
try {
  offset = JSON.parse(readFileSync(OFFSET_FILE, "utf8")).offset || 0;
} catch {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function saveOffset() {
  try {
    writeFileSync(OFFSET_FILE, JSON.stringify({ offset }));
  } catch (e) {
    console.error("offset:", e.message);
  }
}

async function getUpdates() {
  const url =
    `https://api.telegram.org/bot${token}/getUpdates` +
    `?timeout=25&offset=${offset}&allowed_updates=["message","channel_post"]`;
  const r = await fetch(url, { signal: AbortSignal.timeout(35000) });
  const data = await r.json();
  if (!data.ok) throw new Error(`${r.status} ${data.description}`);
  return data.result;
}

function ingest(u) {
  const m = u.message || u.channel_post;
  if (!m) return;
  if (m.from?.is_bot) return;
  if (Number(m.chat?.id) !== chatId) return;
  const text = m.text || m.caption;
  if (!text) return;
  const item = add({
    text,
    source: "telegram",
    externalId: `tg:${m.chat.id}:${m.message_id}`,
    groupId: String(m.chat.id),
    createdAt: new Date(m.date * 1000),
  });
  if (item) console.log(`+ erro de ${m.chat.title || m.chat.id}: ${text.slice(0, 80)}`);
}

export function startPolling() {
  if (!token || !chatId) {
    console.log("polling Telegram desligado (BOT_TOKEN/TG_CHAT_ID)");
    return;
  }
  (async () => {
    console.log(`escutando o grupo ${chatId}`);
    for (;;) {
      try {
        const updates = await getUpdates();
        for (const u of updates) {
          ingest(u);
          offset = u.update_id + 1;
        }
        if (updates.length) saveOffset();
      } catch (e) {
        console.error("telegram poll:", e.message);
        await sleep(3000);
      }
    }
  })();
}
