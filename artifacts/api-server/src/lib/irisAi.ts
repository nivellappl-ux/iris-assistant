import { OpenAIProvider } from "./iris-ai/openAiProvider";
import { GeminiAIProvider } from "./iris-ai/geminiProvider";
import type { IrisAIProvider, IrisConversationMessage, IrisSpeechOutput } from "./iris-ai/contracts";

export type { IrisConversationMessage } from "./iris-ai/contracts";

const providers: Record<"openai" | "gemini", IrisAIProvider> = {
  openai: new OpenAIProvider(),
  gemini: new GeminiAIProvider(),
};

export function getIrisAIProviderMode(): "openai" | "gemini" {
  const configuredMode = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (!configuredMode) return "gemini";
  if (configuredMode === "openai" || configuredMode === "gemini") return configuredMode;
  throw new Error("AI_PROVIDER must be \"openai\" or \"gemini\".");
}

export function isIrisGeminiProviderRateLimited(error: unknown): boolean {
  if (getIrisAIProviderMode() !== "gemini" || typeof error !== "object" || error === null) return false;
  return (error as { status?: unknown }).status === 429;
}

export function isIrisAIProviderAvailable(): boolean {
  try {
    return providers[getIrisAIProviderMode()].isAvailable();
  } catch {
    return false;
  }
}

function getSelectedProvider(): IrisAIProvider {
  return providers[getIrisAIProviderMode()];
}

export async function generateIrisReply(
  message: string,
  history: IrisConversationMessage[],
): Promise<string> {
  const provider = getSelectedProvider();
  if (!provider.isAvailable()) throw new Error(`${provider.mode} AI provider is not available.`);
  return provider.generateReply(message, history);
}

export async function synthesizeIrisSpeech(text: string): Promise<IrisSpeechOutput> {
  const provider = getSelectedProvider();
  if (!provider.isAvailable()) throw new Error(`${provider.mode} AI provider is not available.`);
  return provider.synthesizeSpeech(text);
}
