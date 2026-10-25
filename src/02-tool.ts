/**
 * Demo 2 — An LLM with one tool.
 *
 * Ask about the weather anywhere. Under the hood:
 *   Step 1: we send your message + the tool definition → the model replies "call getWeather({ city })"
 *           → the SDK runs our `execute` function (a real weather API call)
 *   Step 2: the tool result goes back to the model → it writes the answer
 *
 * `stopWhen: stepCountIs(2)` allows exactly one round of tool calls, then an answer.
 *
 * Run: bun run tool   (type `exit` to quit)
 */
import { anthropic } from "@ai-sdk/anthropic";
import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";

const model = anthropic("claude-opus-5-5");

// A tool = description (WHEN to use it) + inputSchema (WHAT to send) + execute (your code).
// Uses the free Open-Meteo API — no key needed.
const getWeather = tool({
  description: "Get the current weather for a city (temperature in °C, wind, today's high/low).",
  inputSchema: z.object({
    city: z.string().describe("City name, e.g. 'Toronto'"),
  }),
  execute: async ({ city }) => {
    // 1. City name → coordinates
    const geo: any = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
    ).then((res) => res.json());
    const place = geo.results?.[0];
    if (!place) return { error: `City not found: ${city}` };

    // 2. Coordinates → weather
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

const messages: ModelMessage[] = [];

console.log("Demo 2 — One tool (getWeather). Type `exit` to quit.\n");
process.stdout.write("You: ");

for await (const line of console) {
  if (line.trim() === "exit") break;

  messages.push({ role: "user", content: line });

  const result = streamText({
    model,
    instructions: "You are a helpful weather assistant. Use the getWeather tool for weather questions.",
    tools: { getWeather },
    stopWhen: stepCountIs(2),
    messages,
  });

  // fullStream gives us text AND tool events, so we can show the tool being used.
  process.stdout.write("\nAssistant: ");
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") process.stdout.write(part.text);
    if (part.type === "tool-call") console.log(`\n🔧 ${part.toolName}(${JSON.stringify(part.input)})`);
    if (part.type === "tool-result") console.log(`   ↳ ${JSON.stringify(part.output)}`);
  }

  messages.push(...(await result.responseMessages));

  process.stdout.write("\n\nYou: ");
}
