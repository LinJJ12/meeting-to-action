import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { MeetingAnalysisSchema } from "../src/domain/schema.js";
import { MinutesDocumentSchema } from "../src/domain/minutes.js";
const references = new URL("../skills/meeting-to-action/references/", import.meta.url);
const schemas: Array<[string, z.ZodType]> = [
  ["analysis.schema.json", MeetingAnalysisSchema],
  ["minutes.schema.json", MinutesDocumentSchema],
];
for (const [file, schema] of schemas)
  await writeFile(
    new URL(file, references),
    JSON.stringify(z.toJSONSchema(schema), null, 2) + "\n",
  );
