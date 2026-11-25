// Escape untrusted text before placing it in Markdown or HTML-capable viewers.
// Single source of truth shared by every renderer: & first, then angle
// brackets, then Markdown-significant punctuation (backslash included), then
// all line breaks collapsed to one space.
export const escapeMarkdownText=(value:string)=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/([\\`*_{}\[\]()#+.!|~-])/g,"\\$1").replace(/[\r\n]+/g," ");

// Narrower variant for running prose inside an already safe block (bullet, table
// cell, heading). Only characters that can still change Markdown structure are
// escaped; `.`/`-`/`+`/`!`/`#`/`(`,`)`/`~` are harmless away from line start, so
// dates like 2026-11-24 and versions like v0.2 stay readable in the source.
export const escapeMarkdownInline=(value:string)=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/([\\`*_{}\[\]|])/g,"\\$1").replace(/[\r\n]+/g," ");