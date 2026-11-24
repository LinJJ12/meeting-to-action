// Escape untrusted text before placing it in Markdown or HTML-capable viewers.
// Single source of truth shared by every renderer: & first, then angle
// brackets, then Markdown-significant punctuation (backslash included), then
// all line breaks collapsed to one space.
export const escapeMarkdownText=(value:string)=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/([\\`*_{}\[\]()#+.!|~-])/g,"\\$1").replace(/[\r\n]+/g," ");