// Escape untrusted text before placing it in Markdown or HTML-capable viewers.
// Single source of truth shared by every renderer: strip terminal escape
// sequences and stray control bytes first, then & and angle brackets, then
// Markdown-significant punctuation (backslash included), then all line breaks
// collapsed to one space.

// Strip terminal escape sequences BEFORE removing stray control bytes: an ESC
// consumed as part of a sequence must not leave its printable tail (e.g. "8;;http://x"
// of an OSC 8 link) behind as visible or spoofable text. Matched semantically per ECMA-48:
//   1. string-terminated sequences (OSC "ESC ]", DCS "ESC P", SOS "ESC X", PM "ESC ^",
//      APC "ESC _" and their C1 initiators) up to BEL / ST ("ESC \\" / 0x9C); an
//      unterminated one is consumed up to the next ESC or end of input - keeping the
//      tail would let a fake URL survive as plain text;
//   2. CSI ("ESC [" or 0x9B) with parameter/intermediate/final byte ranges;
//   3. remaining two-byte ESC sequences (ESC M, ESC ( B, ESC c, ...);
//   4. any leftover C0/C1 control byte (keeping \t; \r\n are collapsed separately below).
// All passes are linear; no nested quantifiers (CWE-150 mitigation, no dependency).
const stripTerminalEscapes=(value:string)=>value
 .replace(/\u001B[\]^PX^_][^\u0007\u001B\u009C]*(?:\u0007|\u001B\\|\u009C)?/g,"")
 .replace(/[\u0090\u0098\u009D\u009E\u009F][^\u0007\u001B\u009C]*(?:\u0007|\u001B\\|\u009C)?/g,"")
 .replace(/\u001B\[[0-9:;<=>?]*[ -/]*[@-~]/g,"")
 .replace(/\u009B[0-9:;<=>?]*[ -/]*[@-~]/g,"")
 .replace(/\u001B[\u0020-\u002F]*[\u0030-\u007E]/g,"")
 .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g,"");

export const escapeMarkdownText=(value:string)=>stripTerminalEscapes(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/([\\`*_{}\[\]()#+.!|~-])/g,"\\$1").replace(/[\r\n]+/g," ");

// Narrower variant for running prose inside an already safe block (bullet, table
// cell, heading). Only characters that can still change Markdown structure are
// escaped; `.`/`-`/`+`/`!`/`#`/`(`,`)`/`~` are harmless away from line start, so
// dates like 2026-11-24 and versions like v0.2 stay readable in the source.
export const escapeMarkdownInline=(value:string)=>stripTerminalEscapes(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/([\\`*_{}\[\]|])/g,"\\$1").replace(/[\r\n]+/g," ");