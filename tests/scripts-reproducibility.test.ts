import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { buildPlugin } from "../scripts/build-plugin.mjs";

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const FIXED_MTIME = Date.UTC(2020, 0, 1) / 1000;

const cString = (buffer: Buffer, offset: number, length: number): string => {
  const field = buffer.subarray(offset, offset + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? field.length : end).toString("utf8");
};
const octal = (buffer: Buffer, offset: number, length: number): number =>
  parseInt(cString(buffer, offset, length).trim(), 8);

type Entry = {
  name: string;
  type: string;
  mode: number;
  uid: number;
  gid: number;
  mtime: number;
  uname: string;
  gname: string;
  size: number;
};

/** 只解析 ustar 头（本脚本自己写归档，无需处理稀疏/PAX 扩展）。 */
function readTar(buffer: Buffer): Entry[] {
  const entries: Entry[] = [];
  for (let offset = 0; offset + 512 <= buffer.length;) {
    const header = buffer.subarray(offset, offset + 512);
    const name = cString(header, 0, 100);
    if (name === "") break;
    const prefix = cString(header, 345, 155);
    const type = header[156] === 0 ? "0" : String.fromCharCode(header[156] as number);
    const size = octal(header, 124, 12);
    entries.push({
      name: prefix === "" ? name : `${prefix}/${name}`,
      type,
      mode: octal(header, 100, 8),
      uid: octal(header, 108, 8),
      gid: octal(header, 116, 8),
      mtime: octal(header, 136, 12),
      uname: cString(header, 265, 32),
      gname: cString(header, 297, 32),
      size,
    });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

it("连续两次 plugin:build 的 tar.gz 字节完全相同且元数据固定", async () => {
  const root = await mkdtemp(join(tmpdir(), "meeting-plugin-repro-"));
  try {
    const first = await buildPlugin(join(root, "first", "plugin-marketplace"));
    const firstBytes = await readFile(first.archive);
    const second = await buildPlugin(join(root, "second", "plugin-marketplace"));
    const secondBytes = await readFile(second.archive);
    expect(sha256(secondBytes)).toBe(sha256(firstBytes));
    expect(secondBytes.equals(firstBytes)).toBe(true);

    // gzip 头：MTIME 必须是固定 0，且不能带 FEXTRA/FNAME/FCOMMENT 等可变字段。
    expect(firstBytes.readUInt32LE(4)).toBe(0);
    expect(firstBytes[3]! & 0b11111).toBe(0);

    const entries = readTar(gunzipSync(firstBytes));
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toMatchObject({ name: "meeting-to-action/", type: "5", mode: 0o755 });
    for (const entry of entries) {
      expect(entry.name, `${entry.name} 不能是绝对路径或带盘符`).not.toMatch(/^(?:\/|[A-Za-z]:)/);
      expect(entry.name).not.toContain("\\");
      expect(entry.uid).toBe(0);
      expect(entry.gid).toBe(0);
      expect(entry.uname).toBe("");
      expect(entry.gname).toBe("");
      expect(entry.mtime).toBe(FIXED_MTIME);
      expect(entry.mode).toBe(entry.type === "5" ? 0o755 : 0o644);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 120_000);
