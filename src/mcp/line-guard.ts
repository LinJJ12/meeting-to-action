import { Transform, type TransformCallback } from "node:stream";

const LF = 0x0a;
const CR = 0x0d;
const NEWLINE = Buffer.from("\n");

/** JSON-RPC 2.0 error frame for a request line that exceeds the transport byte limit. */
export function oversizeLineError(bytes: number, limit: number): string {
  const limitMiB = limit / (1024 * 1024);
  return (
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32600,
        message: `INPUT_SIZE_LIMIT: request line exceeds ${limitMiB} MiB (bytes=${bytes})`,
      },
    }) + "\n"
  );
}

export interface RequestLineGuardOptions {
  /** Maximum accepted byte size of one request line, excluding a CRLF terminator's CR. */
  limit: number;
  /** Called once per oversized line with the byte count that crossed the limit. */
  onOversize: (bytes: number) => void;
}

/**
 * Sits between stdin and the SDK stdio transport.
 *
 * Splits the byte stream on LF (0x0a) so a request line can span any number of
 * chunks, counts UTF-8 bytes rather than characters, and drops only the
 * offending line when its size exceeds `limit`. The line's terminating newline
 * is not forwarded, so the transport never sees an oversized read buffer.
 */
export class RequestLineGuard extends Transform {
  private readonly limit: number;
  private readonly onOversize: (bytes: number) => void;
  private parts: Buffer[] = [];
  private bytesInLine = 0;
  private trailingCR = false;
  private discarding = false;

  constructor(options: RequestLineGuardOptions) {
    super();
    this.limit = options.limit;
    this.onOversize = options.onOversize;
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    let offset = 0;
    while (offset < chunk.length) {
      if (this.discarding) {
        const newline = chunk.indexOf(LF, offset);
        if (newline === -1) {
          break;
        }
        this.discarding = false;
        this.reset();
        offset = newline + 1;
        continue;
      }
      const newline = chunk.indexOf(LF, offset);
      if (newline === -1) {
        this.appendSegment(chunk.subarray(offset));
        break;
      }
      this.appendSegment(chunk.subarray(offset, newline));
      if (this.discarding) {
        // The oversized line was reported; consume its terminator and resume.
        this.discarding = false;
        this.reset();
      } else {
        this.emitLine();
      }
      offset = newline + 1;
    }
    callback();
  }

  override _flush(callback: TransformCallback): void {
    if (!this.discarding) {
      this.emitLine();
    }
    this.discarding = false;
    this.reset();
    callback();
  }

  /**
   * Appends one raw segment of the current line.
   *
   * Every byte counts toward the limit, including CR bytes: a request line that
   * ends with CRLF only gets its final CR excluded (it is a terminator, not
   * payload). CR bytes were previously counted as zero, which let a caller pad a
   * line with CRs and bypass the documented 4 MiB bound.
   *
   * The line can only be proven oversized once its raw size exceeds
   * `limit + 1`: one trailing CR may still turn out to be part of a CRLF
   * terminator. Crossing that bound reports the limit-plus-one offset so the
   * error frame keeps the documented `bytes=<limit + 1>` shape, then the rest
   * of the line is discarded.
   */
  private appendSegment(segment: Buffer): void {
    const length = segment.length;
    if (length === 0) {
      return;
    }
    this.parts.push(segment);
    this.bytesInLine += length;
    this.trailingCR = segment[length - 1] === CR;
    if (this.bytesInLine <= this.limit + 1) {
      return;
    }
    this.onOversize(this.limit + 1);
    this.reset();
    this.discarding = true;
  }

  private emitLine(): void {
    const effectiveBytes = this.bytesInLine - (this.trailingCR ? 1 : 0);
    if (effectiveBytes > this.limit) {
      // The line reached `limit + 1` raw bytes without crossing the streaming
      // bound above because its last byte may still be a CRLF terminator.
      this.onOversize(this.limit + 1);
      this.reset();
      return;
    }
    const joined =
      this.parts.length === 0
        ? Buffer.alloc(0)
        : this.parts.length === 1
          ? this.parts[0]!
          : Buffer.concat(this.parts);
    const payload = this.trailingCR ? joined.subarray(0, joined.length - 1) : joined;
    this.reset();
    if (payload.length === 0) {
      return;
    }
    this.push(payload);
    this.push(NEWLINE);
  }

  private reset(): void {
    this.parts = [];
    this.bytesInLine = 0;
    this.trailingCR = false;
  }
}
