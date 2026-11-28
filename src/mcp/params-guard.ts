import { Transform, type TransformCallback } from "node:stream";

const LF = 0x0a;
const NEWLINE = Buffer.from("\n");
const INVALID_PARAMS_MESSAGE = "INPUT_INVALID: invalid tools/call params";

export interface ParamsGuardOptions {
  /** Called once per rejected request line with the request id (or null when unknown). */
  onInvalidParams: (id: string | number | null) => void;
}

/** JSON-RPC 2.0 error frame for a `tools/call` whose params have the wrong shape. */
export function invalidParamsError(id: string | number | null): string {
  return (
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: INVALID_PARAMS_MESSAGE },
    }) + "\n"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestId(message: unknown): string | number | null {
  if (!isPlainObject(message)) return null;
  const id = message.id;
  return typeof id === "string" || typeof id === "number" ? id : null;
}

/**
 * Rejects `tools/call` requests whose params violate the JSON-RPC shape before
 * the MCP SDK validates them.
 *
 * The SDK answers a schema mismatch with -32603 and a serialized Zod error
 * array. That leaks the SDK's internal schema shape and is the wrong code for
 * caller error, so this guard replies with -32602 and a fixed message instead.
 * Well-formed requests are forwarded byte-for-byte, and requests with malformed
 * JSON are left to the SDK's own -32700 handling.
 */
export class ParamsGuard extends Transform {
  private readonly onInvalidParams: (id: string | number | null) => void;
  private parts: Buffer[] = [];

  constructor(options: ParamsGuardOptions) {
    super();
    this.onInvalidParams = options.onInvalidParams;
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    let offset = 0;
    while (offset < chunk.length) {
      const newline = chunk.indexOf(LF, offset);
      if (newline === -1) {
        this.parts.push(chunk.subarray(offset));
        break;
      }
      this.parts.push(chunk.subarray(offset, newline));
      this.emitLine();
      offset = newline + 1;
    }
    callback();
  }

  override _flush(callback: TransformCallback): void {
    this.emitLine();
    callback();
  }

  private emitLine(): void {
    const joined =
      this.parts.length === 0
        ? Buffer.alloc(0)
        : this.parts.length === 1
          ? this.parts[0]!
          : Buffer.concat(this.parts);
    this.parts = [];
    if (joined.length === 0) return;
    const text = joined.toString("utf8");
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      // Malformed JSON keeps the SDK's own diagnostic path (-32700 / onerror).
      this.push(joined);
      this.push(NEWLINE);
      return;
    }
    if (
      isPlainObject(message) &&
      message.method === "tools/call" &&
      !validCallParams(message.params)
    ) {
      this.onInvalidParams(requestId(message));
      return;
    }
    this.push(joined);
    this.push(NEWLINE);
  }
}

function validCallParams(params: unknown): boolean {
  if (!isPlainObject(params)) return false;
  if (typeof params.name !== "string") return false;
  if ("arguments" in params && !isPlainObject(params.arguments)) return false;
  return true;
}
