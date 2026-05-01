export async function sendTelegramDraftReadyMessage(input: {
  postId: string;
  machine: string;
  topic: string;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const base = process.env.CONTENTOPS_BASE_URL?.replace(/\/$/, "");
  if (!token || !chatId || !base) {
    throw new Error("TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, and CONTENTOPS_BASE_URL must be set for Telegram");
  }
  const url = `${base}/admin/contentops/${input.postId}`;
  const text = `Draft ready: ${input.postId} (${input.machine}/${input.topic})\n${url}`;
  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram send failed: ${res.status} ${errText}`);
  }
}
