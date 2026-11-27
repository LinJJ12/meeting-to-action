import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { MeetingAnalysisSchema } from "../src/domain/schema.js";
it("ships a Skill schema matching the runtime contract", () => {
  const bundled = JSON.parse(
    readFileSync(
      new URL("../skills/meeting-to-action/references/analysis.schema.json", import.meta.url),
      "utf8",
    ),
  );
  expect(bundled).toEqual(z.toJSONSchema(MeetingAnalysisSchema));
});

import { normalizeTranscript } from "../src/core/normalize.js";
import { validateAnalysis } from "../src/core/analysis.js";
import { renderMarkdown } from "../src/render/markdown.js";
import { renderMinutesDocument } from "../src/render/minutes.js";
it("keeps the shipped edge-case demo traceable to the actual transcript", () => {
  const read = (name: string) =>
    readFileSync(new URL("../examples/agent-workflow/" + name, import.meta.url), "utf8");
  const input = normalizeTranscript(read("edge-cases.md"), "edge-cases.md");
  expect(JSON.parse(read("normalized.json"))).toEqual(input);
  const analysis = validateAnalysis(input, JSON.parse(read("analysis.json")));
  expect(renderMarkdown(analysis)).toBe(read("report.md"));
  expect(renderMinutesDocument(input, analysis, JSON.parse(read("minutes.json")))).toBe(
    read("minutes.md"),
  );
  expect(analysis.actionItems.find((x) => x.id === "a1")?.assignee).toBeUndefined();
  expect(analysis.actionItems.find((x) => x.id === "a2")?.dueDate).toBe("next Friday");
  expect(analysis.decisions.find((x) => x.id === "d2")?.status).toBe("unclear");
});
