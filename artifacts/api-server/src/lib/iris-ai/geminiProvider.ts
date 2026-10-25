import { GoogleGenAI } from "@google/genai";
import type { IrisAIProvider, IrisConversationMessage, IrisSpeechOutput } from "./contracts";

const DEFAULT_MODEL = "gemini-3.8-flash";
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

export class GeminiAIProvider implements IrisAIProvider {
  readonly mode = "gemini" as const;
  private client: GoogleGenAI | null = null;

  isAvailable(): boolean {
    return Boolean(
      process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim()
      && process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim(),
    );
  }

  private getClient(): GoogleGenAI {
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
    const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim();
    if (!apiKey || !baseUrl) throw new Error("Gemini AI integration is not configured.");

    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey,
        httpOptions: { apiVersion: "", baseUrl },
      });
    }
    return this.client;
  }

  async generateReply(message: string, history: IrisConversationMessage[]): Promise<string> {
    const response = await this.getClient().models.generateContent({
      model: DEFAULT_MODEL,
      contents: [
        ...history.map(({ role, content }) => ({
          role: role === "assistant" ? "model" : "user",
          parts: [{ text: content }],
        })),
        { role: "user", parts: [{ text: message }] },
      ],
      config: {
        systemInstruction: IRIS_SYSTEM_PROMPT,
        maxOutputTokens: 8192,
      },
    });
    const text = response.text?.trim() ?? "";
    if (!text) throw new Error("Gemini returned an empty response.");
    return text;
  }

  async synthesizeSpeech(_text: string): Promise<IrisSpeechOutput> {
    return { mode: "browser" };
  }
}
