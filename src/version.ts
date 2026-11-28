/**
 * 包版本唯一书写点（#17）。CLI --version、MCP serverInfo.version 与插件清单产物
 * 都从这里取值；package.json 与 plugin/plugin.json 的 version 字段必须与之相等，
 * 由 tests/version-consistency.test.ts 把关。发布时改这里 + 同步 package.json，
 * 或运行 `node scripts/version-sync.mjs <version>` 一键改齐。
 */
export const APP_VERSION = "0.1.2";
