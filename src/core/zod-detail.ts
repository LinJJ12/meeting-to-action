import { ZodError } from "zod";

/**
 * 把 ZodError 收敛成「稳定错误码 + 第一个字段路径」的单行文本。
 *
 * 目的：CLI / MCP 的宿主模型只能看到一行错误，之前只给 `INPUT_SCHEMA_INVALID`，
 * 无法判断是哪个字段的问题（多个真实评测执行者都踩到）。带上路径不泄露字段值。
 */
export function describeZodError(error: unknown, code: string): string | undefined {
  if (!(error instanceof ZodError)) return undefined;
  const issue = error.issues[0];
  if (!issue) return code;
  const path = issue.path.length ? issue.path.join(".") : "input";
  return `${code}: ${path} ${issue.message}`;
}
