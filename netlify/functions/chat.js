import { createHash } from "node:crypto";
import process from "node:process";
import { getStore } from "@netlify/blobs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Usage limits (override with Netlify env vars).
const DAILY_LIMIT_PER_IP = Number(process.env.CHAT_DAILY_LIMIT_PER_IP || 30);
const DAILY_LIMIT_GLOBAL = Number(process.env.CHAT_DAILY_LIMIT_GLOBAL || 300);
const BURST_LIMIT = 5;
const BURST_WINDOW_MS = 10_000;

// Request shape limits, so a single call can't burn lots of tokens.
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 500;
const MAX_REPLY_TOKENS = 250;
const AI_CONTACTS = ["ChatGPT", "Gemini"];

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "https://angelolucaci.com,https://www.angelolucaci.com,https://monumental-croissant-e8ec10.netlify.app,http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Netlify deploy previews: https://<id>--<site>.netlify.app
  return ALLOWED_ORIGINS.some((allowed) => {
    const match = allowed.match(/^https:\/\/([^/]+\.netlify\.app)$/);
    return match && origin.startsWith("https://") && origin.endsWith(`--${match[1]}`);
  });
};

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
});

const jsonResponse = (status, body, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });

const burstBuckets = new Map();

const allowBurst = (ip) => {
  const now = Date.now();
  const bucket = burstBuckets.get(ip);
  if (!bucket || now - bucket.start >= BURST_WINDOW_MS) {
    burstBuckets.set(ip, { start: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  if (burstBuckets.size > 1000) {
    for (const [key, value] of burstBuckets.entries()) {
      if (now - value.start > BURST_WINDOW_MS * 2) {
        burstBuckets.delete(key);
      }
    }
  }
  return bucket.count <= BURST_LIMIT;
};


// Persistent daily counters in Netlify Blobs, shared by all function instances.
const consumeDailyQuota = async (ip) => {
  const store = getStore({ name: "chat-usage", consistency: "strong" });
  const day = new Date().toISOString().slice(0, 10);
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const ipKey = `${day}/ip/${ipHash}`;
  const globalKey = `${day}/global`;

  const [ipCount, globalCount] = await Promise.all([
    store.get(ipKey).then((value) => Number(value) || 0),
    store.get(globalKey).then((value) => Number(value) || 0),
  ]);

  if (globalCount >= DAILY_LIMIT_GLOBAL) {
    return "ChatGPT is taking a break for today. Come back tomorrow!";
  }
  if (ipCount >= DAILY_LIMIT_PER_IP) {
    return `You've reached today's limit of ${DAILY_LIMIT_PER_IP} messages. Come back tomorrow!`;
  }

  await Promise.all([
    store.set(ipKey, String(ipCount + 1)),
    store.set(globalKey, String(globalCount + 1)),
  ]);
  return null;
};

const sanitizeMessages = (messages) =>
  (Array.isArray(messages) ? messages : [])
    .filter(
      (message) =>
        (message?.role === "user" || message?.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, MAX_MESSAGE_CHARS),
    }));

const sanitizeName = (value, fallback) =>
  String(value || fallback)
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .slice(0, 32) || fallback;

export default async (request, context) => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." }, origin);
  }

  if (!isAllowedOrigin(origin)) {
    return jsonResponse(403, { error: "Forbidden." }, origin);
  }

  const ip = context.ip || "unknown";
  if (!allowBurst(ip)) {
    return jsonResponse(429, { error: "Slow down a bit and try again in a moment." }, origin);
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse(500, { error: "Missing OPENAI_API_KEY." }, origin);
  }

  const rawBody = await request.text();
  if (rawBody.length > 20_000) {
    return jsonResponse(413, { error: "Message too long." }, origin);
  }

  let body;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." }, origin);
  }

  const messages = sanitizeMessages(body?.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return jsonResponse(400, { error: "No message to reply to." }, origin);
  }

  const username = sanitizeName(body?.username, "user");
  const contactName = AI_CONTACTS.includes(body?.contactName) ? body.contactName : "ChatGPT";
  const systemPrompt = `You are ${contactName} chatting with ${username} in Yahoo Messenger. Keep replies concise.`;

  try {
    const limitMessage = await consumeDailyQuota(ip);
    if (limitMessage) {
      return jsonResponse(429, { error: limitMessage }, origin);
    }
  } catch (error) {
    console.error("Usage tracking error", error);
    // Fail closed: without usage tracking we can't bound spend.
    return jsonResponse(503, { error: "Chat is unavailable right now." }, origin);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.7,
        max_tokens: MAX_REPLY_TOKENS,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      // Don't leak upstream error details to the client.
      console.error("OpenAI error", response.status, data?.error?.message);
      return jsonResponse(502, { error: "ChatGPT couldn't reply right now." }, origin);
    }

    const reply = data?.choices?.[0]?.message?.content?.trim() || "";
    return jsonResponse(200, { reply }, origin);
  } catch (error) {
    console.error("Chat function error", error);
    return jsonResponse(500, { error: "Server error." }, origin);
  }
};
