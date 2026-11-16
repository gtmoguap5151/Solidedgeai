function requireText(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(name + " must be a non-empty string");
  }
  return value.trim();
}

function parseModelJson(content) {
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("MODEL_RESPONSE_EMPTY");
  }
  const text = content.trim();
  const candidate = text.startsWith("```")
    ? text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : text;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error("MODEL_RESPONSE_NOT_VALID_JSON");
  }
}

/**
 * OpenAI-compatible chat-completions transport.
 * It performs no request until generate() is explicitly called.
 * Credentials are read from the process environment and never persisted.
 */
export function createOpenAICompatibleProvider({
  baseUrl = process.env.GALINYX_MODEL_BASE_URL,
  apiKey = process.env.GALINYX_MODEL_API_KEY,
  model = process.env.GALINYX_MODEL_NAME,
  fetchImpl = globalThis.fetch,
  maxOutputTokens = 1200,
} = {}) {
  const endpointBase = requireText(baseUrl, "GALINYX_MODEL_BASE_URL").replace(/\/+$/, "");
  const selectedModel = requireText(model, "GALINYX_MODEL_NAME");
  const key = requireText(apiKey, "GALINYX_MODEL_API_KEY");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation required");
  const url = new URL(endpointBase);
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) throw new Error("MODEL_ENDPOINT_MUST_USE_HTTPS_OR_LOCALHOST");

  return Object.freeze({
    async generate({ system, prompt, maxTokens = maxOutputTokens }) {
      const tokenLimit = Math.min(maxOutputTokens, Number.isInteger(maxTokens) ? maxTokens : maxOutputTokens);
      if (tokenLimit < 1 || tokenLimit > 4000) throw new RangeError("MODEL_TOKEN_LIMIT_OUT_OF_RANGE");
      const response = await fetchImpl(endpointBase + "/chat/completions", {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          temperature: 0.1,
          max_tokens: tokenLimit,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!response?.ok) throw new Error("MODEL_PROVIDER_HTTP_" + (response?.status ?? "NO_RESPONSE"));
      const body = await response.json();
      const content = body?.choices?.[0]?.message?.content;
      return parseModelJson(content);
    },
  });
}
