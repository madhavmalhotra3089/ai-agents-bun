/**
 * Demo 1 — A simple LLM chat. No tools, no agent loop.
 *
 * Each message you type = one request to the model, streamed back.
 * The model is stateless: it "remembers" only because we resend the whole conversation every time.
 *
 * Run: bun run simple   (type `exit` to quit)
 */
import { anthropic } from "@ai-sdk/anthropic";
import { streamText, type ModelMessage } from "ai";

// Reads ANTHROPIC_API_KEY from .env (Bun loads it automatically).
const model = anthropic("claude-opus-5-5");

const messages: ModelMessage[] = [];

console.log("Demo 1 — Simple chat. Type `exit` to quit.\n");
process.stdout.write("You: ");

// In Bun, `console` is an async iterable of the lines you type.
for await (const line of console) {
  if (line.trim() === "exit") break;

  messages.push({ role: "user", content: line });

  const result = streamText({
    model,
    instructions: "You are a friendly, concise assistant.",
    messages,
  });

  process.stdout.write("\nAssistant: ");
  for await (const text of result.textStream) {
    process.stdout.write(text);
  }

  // Add the model's reply to the history so the next turn has context.
  messages.push(...(await result.responseMessages));

  process.stdout.write("\n\nYou: ");
}
