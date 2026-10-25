/**
 * Demo 3 — An agent running in a loop.
 *
 * The agent loop:
 *     while (model wants to call tools && under the step limit) {
 *       call model → run requested tools → append results to the conversation
 *     }
 *
 * The model decides which tools to call, in what order, and when it's done.
 * ToolLoopAgent packages that loop with its config (model, instructions, tools, stop condition).
 *
 * Things to try:
 *   - "Compare the weather in Toronto, Tokyo and Cape Town. What's the average temperature?"
 *   - "Which is warmer right now, Paris or Rome, and by how much? Save the answer as a note."
 *   - "What notes have you saved?"
 *
 * Run: bun run agent   (type `exit` to quit)
 */
import { anthropic } from "@ai-sdk/anthropic";
import { ToolLoopAgent, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";

const model = anthropic("claude-opus-5-5");

// ---- Tools -----------------------------------------------------------------

const getWeather = tool({
  description: "Get the current weather for a city (temperature in °C, wind, today's high/low).",
  inputSchema: z.object({
    city: z.string().describe("City name, e.g. 'Toronto'"),
  }),
  execute: async ({ city }) => {
    const geo: any = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
    ).then((res) => res.json());
    const place = geo.results?.[0];
    if (!place) return { error: `City not found: ${city}` };

    const weather: any = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`,
    ).then((res) => res.json());

    return {
      location: `${place.name}, ${place.country}`,
      tempC: weather.current.temperature_2m,
      windKmh: weather.current.wind_speed_10m,
      todayHighC: weather.daily.temperature_2m_max[0],
      todayLowC: weather.daily.temperature_2m_min[0],
    };
  },
});

const calculator = tool({
  description: "Do basic arithmetic. Use this instead of doing math in your head.",
  inputSchema: z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    if (operation === "add") return { result: a + b };
    if (operation === "subtract") return { result: a - b };
    if (operation === "multiply") return { result: a * b };
    return { result: a / b };
  },
});

const notes: string[] = [];

const saveNote = tool({
  description: "Save a short note when the user asks you to remember or record something.",
  inputSchema: z.object({ note: z.string() }),
  execute: async ({ note }) => {
    notes.push(note);
    return { saved: true };
  },
});

const listNotes = tool({
  description: "List all notes saved so far.",
  inputSchema: z.object({}),
  execute: async () => ({ notes }),
});

// ---- Agent -----------------------------------------------------------------

const agent = new ToolLoopAgent({
  model,
  instructions:
    "You are a travel assistant. You always talk like Darth Vader.",
  tools: { getWeather, calculator, saveNote, listNotes },
  stopWhen: stepCountIs(10), // safety net: at most 10 model calls per message
});

// ---- Chat ------------------------------------------------------------------

const messages: ModelMessage[] = [];

console.log("Demo 3 — Agent loop with 4 tools. Type `exit` to quit.\n");
process.stdout.write("You: ");

for await (const line of console) {
  if (line.trim() === "exit") break;

  messages.push({ role: "user", content: line });

  const result = await agent.stream({ messages });

  // Print each loop iteration ("step") so you can watch the agent work.
  let step = 0;
  for await (const part of result.fullStream) {
    if (part.type === "start-step") console.log(`\n── step ${++step} ──`);
    if (part.type === "text-delta") process.stdout.write(part.text);
    if (part.type === "tool-call") console.log(`🔧 ${part.toolName}(${JSON.stringify(part.input)})`);
    if (part.type === "tool-result") console.log(`   ↳ ${JSON.stringify(part.output)}`);
  }

  messages.push(...(await result.responseMessages));

  process.stdout.write("\n\nYou: ");
}
