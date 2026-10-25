export interface IrisConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export type IrisSpeechOutput =
  | { readonly mode: "audio"; readonly audio: Buffer; readonly mimeType: "audio/mpeg" }
  | { readonly mode: "browser" };

export interface IrisAIProvider {
  readonly mode: "openai" | "gemini";
  isAvailable(): boolean;
  generateReply(message: string, history: IrisConversationMessage[]): Promise<string>;
  synthesizeSpeech(text: string): Promise<IrisSpeechOutput>;
}
