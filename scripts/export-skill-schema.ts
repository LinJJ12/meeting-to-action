import {writeFile} from "node:fs/promises";
import {z} from "zod";
import {MeetingAnalysisSchema} from "../src/domain/schema.js";
await writeFile(new URL("../skills/meeting-to-action/references/analysis.schema.json",import.meta.url),JSON.stringify(z.toJSONSchema(MeetingAnalysisSchema),null,2)+"\n");
