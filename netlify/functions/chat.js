const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const RATE_LIMIT = 5;
const WINDOW_MS = 1000;

const rateBuckets = new Map();

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  },
  body: JSON.stringify(body),
});

const allowRequest = (ip) => {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
    rateBuckets.set(ip, { start: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  if (rateBuckets.size > 1000) {
    for (const [key, value] of rateBuckets.entries()) {
      if (now - value.start > WINDOW_MS * 2) {
        rateBuckets.delete(key);
      }
    }
  }
  return bucket.count <= RATE_LIMIT;
};

const getClientIp = (headers) => {
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headers["x-nf-client-connection-ip"] || "unknown";
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const ip = getClientIp(event.headers || {});
  if (!allowRequest(ip)) {
    return jsonResponse(429, { error: "Rate limit exceeded. Try again in a moment." });
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse(500, { error: "Missing OPENAI_API_KEY." });
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (error) {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const username = body?.username || "user";
  const contactName = body?.contactName || "ChatGPT";
  const systemPrompt = `You are ${contactName} chatting with ${username} in Yahoo Messenger. Keep replies concise.`;

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
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return jsonResponse(response.status, {
        error: data?.error?.message || "OpenAI error.",
      });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim() || "";
    return jsonResponse(200, { reply });
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Server error." });
  }
};
