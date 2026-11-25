// Descobre o chat_id do grupo: adicione o bot ao grupo, mande uma mensagem
// qualquer lá (ou promova o bot a admin) e rode: node scripts/chatid.js
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("defina BOT_TOKEN no .env");
  process.exit(1);
}

const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const data = await r.json();
if (!data.ok) {
  console.error(data.description);
  process.exit(1);
}

const seen = new Map();
for (const u of data.result) {
  const chat = u.message?.chat || u.my_chat_member?.chat || u.channel_post?.chat;
  if (chat) seen.set(chat.id, chat);
}
if (!seen.size) {
  console.log("nenhum update. Adicione o bot ao grupo e mande uma mensagem lá.");
  process.exit(0);
}
for (const [id, chat] of seen) {
  console.log(`${String(id).padEnd(20)} ${chat.type.padEnd(10)} ${chat.title || chat.username || chat.first_name}`);
}
