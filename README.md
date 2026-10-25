# Building AI Agents with TypeScript + Bun

Three short demos that go from a single LLM call to a full agent loop, using:

- **[Bun](https://bun.sh)**: runtime. Runs TypeScript directly and loads `.env` automatically.
- **[Vercel AI SDK](https://ai-sdk.dev)** (`ai` v7): `generateText`, `streamText`, `tool`, `ToolLoopAgent`
- **`@ai-sdk/anthropic`**: the Anthropic (Claude) provider
- **[Zod](https://zod.dev)**: schemas for tool inputs

## Setup

```bash
bun install
cp .env.example .env   # then put your Anthropic API key in .env
```

Get a key at https://console.anthropic.com. Every demo uses `claude-opus-5-5`; to change it, edit the `anthropic("...")` line at the top of the file.

## The demos

Every demo is a **live chat in your terminal**. Type a message, watch the reply stream in, and keep talking; it remembers the conversation. Type `exit` to quit.

| # | Command | File | Concept |
|---|---------|------|---------|
| 1 | `bun run simple` | [src/01-simple.ts](src/01-simple.ts) | A plain chat. No tools: each message is one model call, streamed back. |
| 2 | `bun run tool` | [src/02-tool.ts](src/02-tool.ts) | The model has **one tool** (`getWeather`, real live weather). It gets one round of tool calls, then answers. |
| 3 | `bun run agent` | [src/03-agent-loop.ts](src/03-agent-loop.ts) | An **agent loop** with 4 tools. The model keeps calling tools until the task is done (at most 10 steps). |

Each file is **self-contained**, with its model, tools and chat loop all in one place, so you can read it top to bottom. Code is repeated between files on purpose. The weather tool uses [Open-Meteo](https://open-meteo.com), which is free and needs no key.

### Things to try

**Demo 1:** "What's an AI agent?" then "Explain that to a 10-year-old". The second question only works because we resend the history.

**Demo 2:** "Should I bring an umbrella in Vancouver today?" then "What about Toronto and Montreal?" Several cities can be looked up in parallel within one step. Then try "Which is warmer, Paris or Rome, and by how many degrees?" The model has no calculator and only one round of tool calls, so it can't check its arithmetic. That's the motivation for demo 3.

**Demo 3:**
- "Compare the weather in Toronto, Tokyo and Cape Town. What's the average temperature?"
- "Which is warmer right now, Paris or Rome, and by how much? Save the answer as a note."
- "What notes have you saved?"

## How the pieces fit

```
Demo 1:  prompt ──► model ──► text

Demo 2:  prompt ──► model ──► tool call ──► execute() ──► model ──► text
                    (step 1)                              (step 2)

Demo 3:  prompt ──► ┌──────────────────────────────────────────┐
                    │ model ──► tool calls? ──yes──► execute() │──┐
                    │   ▲                                      │  │
                    │   └────────── results ◄─────────────────────┘
                    └──── no tool calls (or step limit) ──► text
```

Key ideas:
- **A tool** has a `description` (when to use it), an `inputSchema` (Zod: what arguments to send) and `execute` (your code).
- **The model never runs code.** It only *asks* for a tool call. The SDK runs `execute` and sends the result back.
- **`stopWhen: stepCountIs(n)`** controls the loop. Each step is one model call. Without it, `generateText` stops after the first step.
- **`ToolLoopAgent`** packages the model, instructions, tools and stop condition into an agent you can reuse with `agent.generate()` or `agent.stream()`.

## Other scripts

```bash
bun run typecheck   # tsc --noEmit
```
