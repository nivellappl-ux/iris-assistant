import assert from "node:assert/strict";
import test from "node:test";
import {
  generateIrisReply,
  getIrisAIProviderMode,
  isIrisAIProviderAvailable,
  isIrisGeminiProviderRateLimited,
} from "../../dist/irisAi.test.mjs";

const integrationKeys = ["AI_INTEGRATIONS_GEMINI_BASE_URL", "AI_INTEGRATIONS_GEMINI_API_KEY"];
const restoreEnvironment = (previous) => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

test("AI_PROVIDER defaults to Replit-managed Gemini without selecting OpenAI", () => {
  const previous = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    ...Object.fromEntries(integrationKeys.map((key) => [key, process.env[key]])),
  };
  delete process.env.AI_PROVIDER;
  for (const key of integrationKeys) delete process.env[key];
  try {
    assert.equal(getIrisAIProviderMode(), "gemini");
    assert.equal(isIrisAIProviderAvailable(), false);
  } finally {
    restoreEnvironment(previous);
  }
});

test("removed mock mode is rejected instead of returning fictional company data", () => {
  const previous = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "mock";
  try {
    assert.throws(() => getIrisAIProviderMode(), /AI_PROVIDER must be "openai" or "gemini"/);
  } finally {
    if (previous === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previous;
  }
});

test("Gemini SDK sends the IRIS prompt, conversation history and current turn", async () => {
  const previous = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    ...Object.fromEntries(integrationKeys.map((key) => [key, process.env[key]])),
  };
  const previousFetch = globalThis.fetch;
  process.env.AI_PROVIDER = "gemini";
  process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = "https://gemini.integration.test";
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY = "integration-test-placeholder";

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.match(url, /gemini-3\.8-flash:generateContent/);
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.contents, [
      { role: "user", parts: [{ text: "Pergunta anterior." }] },
      { role: "model", parts: [{ text: "Resposta anterior." }] },
      { role: "user", parts: [{ text: "Pergunta atual." }] },
    ]);
    assert.equal(body.generationConfig.maxOutputTokens, 8192);
    assert.match(body.systemInstruction.parts[0].text, /não está ligada|not connected/i);
    return new Response(JSON.stringify({
      candidates: [{ content: { role: "model", parts: [{ text: "Olá, sou a IRIS." }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    assert.equal(await generateIrisReply("Pergunta atual.", [
      { role: "user", content: "Pergunta anterior." },
      { role: "assistant", content: "Resposta anterior." },
    ]), "Olá, sou a IRIS.");
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnvironment(previous);
  }
});

test("Gemini rate limits are identified only while Gemini is selected", () => {
  const previous = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = "gemini";
  try {
    assert.equal(isIrisGeminiProviderRateLimited({ status: 429 }), true);
    process.env.AI_PROVIDER = "openai";
    assert.equal(isIrisGeminiProviderRateLimited({ status: 429 }), false);
  } finally {
    if (previous === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previous;
  }
});
