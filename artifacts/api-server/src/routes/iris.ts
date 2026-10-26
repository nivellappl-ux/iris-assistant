import { IrisChatBody, IrisChatResponse, IrisSpeechBody, IrisSpeechResponse } from "@workspace/api-zod";
import { Router, type IRouter, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { AccessToken, RoomConfiguration } from "livekit-server-sdk";
import {
  generateIrisReply,
  getIrisAIProviderMode,
  isIrisAIProviderAvailable,
  isIrisGeminiProviderRateLimited,
  synthesizeIrisSpeech,
} from "../lib/irisAi";

const router: IRouter = Router();
const REQUEST_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const configuredHosts = new Set(
  [
    ...(process.env.REPLIT_DOMAINS ?? "").split(","),
    process.env.REPLIT_DEV_DOMAIN ?? "",
  ]
    .map((domain) => domain.trim())
    .filter(Boolean)
    .map((domain) => {
      try {
        return new URL(domain.includes("://") ? domain : `https://${domain}`).host.toLowerCase();
      } catch {
        return "";
      }
    })
    .filter(Boolean),
);

function safeProviderErrorFields(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { errorName: "UnknownError" };
  }

  const providerError = error as { name?: unknown; status?: unknown; code?: unknown; type?: unknown };
  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    ...(typeof providerError.status === "number" ? { providerStatus: providerError.status } : {}),
    ...(typeof providerError.code === "string" ? { providerCode: providerError.code.slice(0, 80) } : {}),
    ...(typeof providerError.type === "string" ? { providerType: providerError.type.slice(0, 80) } : {}),
  };
}

function isProviderQuotaExhausted(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const providerError = error as { status?: unknown; code?: unknown; type?: unknown };
  return providerError.status === 429
    && (providerError.code === "credit_balance_exhausted" || providerError.type === "insufficient_quota");
}

const requireTrustedOrigin: RequestHandler = (req, res, next) => {
  const origin = req.get("origin");
  if (!origin) {
    res.status(403).json({ error: "A origem deste pedido não é autorizada." });
    return;
  }

  if (
    origin === "tauri://localhost"
    || origin === "http://tauri.localhost"
    || origin === "https://tauri.localhost"
  ) {
    next();
    return;
  }

  try {
    const parsed = new URL(origin);
    const sameOrigin = parsed.host.toLowerCase() === req.get("host")?.toLowerCase();
    const configuredOrigin = configuredHosts.has(parsed.host.toLowerCase());
    const localDevelopmentOrigin = process.env.NODE_ENV !== "production"
      && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);

    if (sameOrigin || configuredOrigin || localDevelopmentOrigin) {
      next();
      return;
    }
  } catch {
    // Reject malformed origins below.
  }

  res.status(403).json({ error: "A origem deste pedido não é autorizada." });
};

const limitAIRequests: RequestHandler = (req, res, next) => {
  const now = Date.now();
  const clientKey = req.ip || "unknown";
  const existing = requestCounts.get(clientKey);

  if (!existing || existing.resetAt <= now) {
    requestCounts.set(clientKey, { count: 1, resetAt: now + REQUEST_WINDOW_MS });
    next();
    return;
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: "Demasiados pedidos de IA. Aguarda um minuto e tenta novamente." });
    return;
  }

  existing.count += 1;
  next();
};

router.post("/iris/chat", requireTrustedOrigin, limitAIRequests, async (req, res): Promise<void> => {
  const parsed = IrisChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A mensagem ou o histórico não têm um formato válido." });
    return;
  }

  if (!isIrisAIProviderAvailable()) {
    res.status(503).json({ error: "O provider de IA não está disponível neste momento." });
    return;
  }

  try {
    const text = await generateIrisReply(parsed.data.message, parsed.data.history ?? []);
    res.json(IrisChatResponse.parse({ text }));
  } catch (error) {
    if (getIrisAIProviderMode() === "openai" && isProviderQuotaExhausted(error)) {
      req.log.warn(safeProviderErrorFields(error), "IRIS chat blocked by OpenAI usage quota");
      res.status(402).json({ error: "A conta OpenAI está sem saldo ou atingiu o limite de utilização. Verifica a faturação da conta." });
      return;
    }
    if (isIrisGeminiProviderRateLimited(error)) {
      req.log.warn(safeProviderErrorFields(error), "IRIS Gemini provider rate limited");
      res.status(429).json({ error: "O limite de pedidos do Gemini foi atingido. Aguarda um momento e tenta novamente." });
      return;
    }
    req.log.error(
      safeProviderErrorFields(error),
      "IRIS chat provider request failed",
    );
    res.status(502).json({ error: "Não consegui gerar uma resposta agora. Tenta novamente daqui a pouco." });
  }
});

router.post("/iris/speech", requireTrustedOrigin, limitAIRequests, async (req, res): Promise<void> => {
  const parsed = IrisSpeechBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "O texto para a resposta de voz não é válido." });
    return;
  }

  if (!isIrisAIProviderAvailable()) {
    res.status(503).json({ error: "O provider de voz não está disponível neste momento." });
    return;
  }

  try {
    const speech = await synthesizeIrisSpeech(parsed.data.text);
    const response = speech.mode === "audio"
      ? {
          mode: "audio" as const,
          audioBase64: speech.audio.toString("base64"),
          mimeType: speech.mimeType,
        }
      : { mode: "browser" as const };
    res.json(IrisSpeechResponse.parse(response));
  } catch (error) {
    if (getIrisAIProviderMode() === "openai" && isProviderQuotaExhausted(error)) {
      req.log.warn(safeProviderErrorFields(error), "IRIS speech blocked by OpenAI usage quota");
      res.status(402).json({ error: "A conta OpenAI está sem saldo ou atingiu o limite de utilização. Verifica a faturação da conta." });
      return;
    }
    if (isIrisGeminiProviderRateLimited(error)) {
      req.log.warn(safeProviderErrorFields(error), "IRIS Gemini provider rate limited for speech");
      res.status(429).json({ error: "O limite de pedidos do Gemini foi atingido. Aguarda um momento e tenta novamente." });
      return;
    }
    req.log.error(
      safeProviderErrorFields(error),
      "IRIS speech provider request failed",
    );
    res.status(502).json({ error: "Não consegui preparar a voz Nova agora." });
  }
});

router.post("/iris/livekit/token", requireTrustedOrigin, limitAIRequests, async (req, res): Promise<void> => {
  if (process.env.NODE_ENV !== "development") {
    res.status(403).json({ error: "A conversa por voz está disponível apenas no ambiente de desenvolvimento." });
    return;
  }

  const serverUrl = process.env.LIVEKIT_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!serverUrl || !apiKey || !apiSecret) {
    res.status(503).json({ error: "O serviço de voz não está configurado." });
    return;
  }

  try {
    const roomName = `iris-dev-${randomUUID()}`;
    const participantToken = new AccessToken(apiKey, apiSecret, {
      identity: `iris-user-${randomUUID()}`,
      name: "Utilizador IRIS",
      ttl: "5m",
    });
    participantToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    participantToken.roomConfig = RoomConfiguration.fromJson({
      agents: [{ agentName: "iris-voice" }],
    });

    res.json({ serverUrl, participantToken: await participantToken.toJwt(), roomName });
  } catch (error) {
    req.log.error({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Could not issue IRIS LiveKit token");
    res.status(502).json({ error: "Não foi possível iniciar a sessão de voz." });
  }
});

export default router;
