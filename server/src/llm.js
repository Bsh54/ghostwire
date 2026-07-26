// Thin client for the assistant "brain" — DeepSeek (OpenAI-compatible API).
const BASE = process.env.LLM_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.LLM_MODEL || "deepseek-v4-flash";

export async function chatCompletion(messages, tools) {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error("LLM_API_KEY missing in .env");
  const body = { model: MODEL, messages, temperature: 0.3 };
  if (tools && tools.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices[0].message;
}

// One-shot helper for a service to actually do its work.
export async function ask(system, user) {
  const msg = await chatCompletion([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  return msg.content || "";
}
