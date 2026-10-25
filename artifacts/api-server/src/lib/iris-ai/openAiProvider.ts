import OpenAI from "openai";
import type { IrisAIProvider, IrisConversationMessage, IrisSpeechOutput } from "./contracts";

const CHAT_MODEL = "gpt-5.4";
const SPEECH_MODEL = "gpt-4o-mini-tts";
const IRIS_SYSTEM_PROMPT = [
  "You are IRIS, a warm and thoughtful assistant being prepared as the intelligent operational interface for Duvion.",
  "Reply naturally in Portuguese, matching the user's language and level of detail.",
  "You can discuss general topics, answer questions, brainstorm, and explain ideas.",
  "This installation is not connected to a Duvion workspace, company data, authentication, or Duvion action tools.",
  "Never invent Duvion features, company facts, customers, transactions, metrics, endpoints, or actions.",
  "When asked to retrieve company-specific Duvion information or perform a Duvion action, say clearly that Duvion is not connected here and that you cannot retrieve or perform it yet.",
  "You do not have access to the user's tasks, inbox, projects, files, or other local app data.",
  "Never claim to have read, created, changed, or completed anything in the app.",
  "If asked about local app data, say you cannot see it and suggest using IRIS's local commands.",
  "Keep ordinary replies concise, and ask a brief follow-up when the request is unclear.",
].join(" ");

export class OpenAIProvider implements IrisAIProvider {
  readonly mode = "openai" as const;
  private client: OpenAI | null = null;

  isAvailable(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  private getClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("OpenAI is not configured.");

    if (!this.client) {
      this.client = new OpenAI({
        apiKey,
        maxRetries: 1,
        timeout: 45_000,
      });
    }

    return this.client;
  }

  async generateReply(
    message: string,
    history: IrisConversationMessage[],
  ): Promise<string> {
    const completion = await this.getClient().chat.completions.create({
      model: CHAT_MODEL,
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: IRIS_SYSTEM_PROMPT },
        ...history,
        { role: "user", content: message },
      ],
    });

    const content = completion.choices[0]?.message.content;
    const text = typeof content === "string" ? content.trim() : "";
    if (!text) throw new Error("OpenAI returned an empty response.");
    return text;
  }

  async synthesizeSpeech(text: string): Promise<IrisSpeechOutput> {
    const response = await this.getClient().audio.speech.create({
      model: SPEECH_MODEL,
      voice: "nova",
      input: text,
      response_format: "mp3",
      instructions: "Use a warm, calm feminine voice. Speak Portuguese naturally and read only the supplied text.",
    });

    return {
      mode: "audio",
      audio: Buffer.from(await response.arrayBuffer()),
      mimeType: "audio/mpeg",
    };
  }
}
