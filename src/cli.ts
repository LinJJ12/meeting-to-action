import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { normalizeTranscript } from "./core/normalize.js";
import { analyzeMeeting } from "./core/analyze.js";
import { renderMarkdown } from "./render/markdown.js";
import { OpenAICompatibleProvider } from "./providers/openai-compatible.js";

function usage(): never {
  console.error([
    "Usage:",
    "  meeting-to-action inspect <transcript.txt|transcript.md> [--out normalized.json]",
    "  meeting-to-action analyze <transcript.txt|transcript.md> [--out report.md]",
    "",
    "Environment for analyze:",
    "  OPENAI_API_KEY (required)",
    "  OPENAI_MODEL (required)",
    "  OPENAI_BASE_URL (optional; defaults to https://api.openai.com/v1)",
    "  OPENAI_TIMEOUT_MS (optional; defaults to 60000)",
  ].join("\n"));
  process.exit(2);
}

const [command, input, ...args] = process.argv.slice(2);
if (!command || !input || !["inspect", "analyze"].includes(command)) usage();

let outputPath: string | undefined;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--out" && args[index + 1]) outputPath = args[++index];
  else usage();
}

try {
  const absoluteInput = resolve(input);
  const transcript = await readFile(absoluteInput, "utf8");
  const meeting = normalizeTranscript(transcript, basename(absoluteInput));

  let output: string;
  if (command === "inspect") {
    output = JSON.stringify(meeting, null, 2) + "\n";
  } else {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL;
    if (!apiKey || !model) {
      throw new Error("CONFIG_MISSING: set OPENAI_API_KEY and OPENAI_MODEL before running analyze");
    }
    const timeout = Number(process.env.OPENAI_TIMEOUT_MS ?? "60000");
    if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 300000) {
      throw new Error("CONFIG_INVALID: OPENAI_TIMEOUT_MS must be an integer between 1000 and 300000");
    }
    const provider = new OpenAICompatibleProvider({
      apiKey,
      model,
      ...(process.env.OPENAI_BASE_URL ? { baseUrl: process.env.OPENAI_BASE_URL } : {}),
      timeoutMs: timeout,
    });
    const analysis = await analyzeMeeting(meeting, provider);
    output = renderMarkdown(analysis);
  }

  if (outputPath) {
    await writeFile(resolve(outputPath), output, { encoding: "utf8", flag: "wx" });
    console.log("Wrote " + resolve(outputPath));
  } else process.stdout.write(output);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
