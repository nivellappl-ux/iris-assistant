import {
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
  type JobContext,
} from "@livekit/agents";
import { fileURLToPath } from "node:url";

const liveKitUrl = process.env.LIVEKIT_URL?.trim();
if (liveKitUrl) process.env.LIVEKIT_URL = liveKitUrl.replace(/\/+$/, "");

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const session = new voice.AgentSession({
      stt: new inference.STT({ model: "deepgram/nova-3", language: "pt-PT" }),
      llm: new inference.LLM({ model: "google/gemma-4-31b-it" }),
      tts: new inference.TTS({
        model: "gradium/default",
        voice: "7yIuXOsv9bkpmRVv",
        language: "pt",
      }),
      turnHandling: {
        turnDetection: new inference.TurnDetector(),
      },
    });

    await session.start({
      agent: voice.Agent.create({
        instructions: [
          "És a IRIS, uma assistente de voz conversacional em português.",
          "Responde de forma natural, breve e clara, adequada a uma conversa falada.",
          "Não afirmes que tens acesso a dados da empresa, à Duvion ou a ações que não foram fornecidos nesta sessão.",
          "Não solicites nem reveles dados pessoais sensíveis.",
        ].join(" "),
      }),
      room: ctx.room,
      record: false,
    });

    await ctx.connect();
    await session.generateReply({
      instructions: "Cumprimenta a pessoa em português e pergunta como podes ajudar.",
    });
  },
});

cli.runApp(new ServerOptions({
  agent: fileURLToPath(import.meta.url),
  agentName: "iris-voice",
}));
