// Escape untrusted text before placing it in Markdown or HTML-capable viewers.
// Single source of truth shared by every renderer: strip terminal escape
// sequences and stray control bytes first, then & and angle brackets, then
// Markdown-significant punctuation (backslash included), then all line breaks
// collapsed to one space.

// Strip complete ANSI sequences BEFORE removing stray control bytes: an ESC
// consumed as part of CSI/OSC must not leave its printable tail (e.g. "[2J")
// behind as visible garbage. Covers ESC and C1-CSI (0x9B) forms, including
// OSC links terminated by BEL or ST, then any leftover C0/C1 control byte
// (keeping \t; \r\n are collapsed separately below). Semantics follow
// strip-ansi (https://www.npmjs.com/package/strip-ansi), CWE-150 mitigation.
const stripTerminalEscapes=(value:string)=>value
 .replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.=?%@$^~_:! ]*)?)\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PRZcf-ntqry=><~]))/g,"")
 .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g,"");

export const escapeMarkdownText=(value:string)=>stripTerminalEscapes(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/([\\`*_{}\[\]()#+.!|~-])/g,"\\$1").replace(/[\r\n]+/g," ");

// Narrower variant for running prose inside an already safe block (bullet, table
// cell, heading). Only characters that can still change Markdown structure are
// escaped; `.`/`-`/`+`/`!`/`#`/`(`,`)`/`~` are harmless away from line start, so
// dates like 2026-11-24 and versions like v0.2 stay readable in the source.
export const escapeMarkdownInline=(value:string)=>stripTerminalEscapes(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/([\\`*_{}\[\]|])/g,"\\$1").replace(/[\r\n]+/g," ");