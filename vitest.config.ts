import {defineConfig} from "vitest/config";

// CLI 用例通过 `node --import tsx src/cli.ts` 冷启动子进程，并行跑全套时单次启动
// 可能超过 Vitest 默认的 5s；这里统一放宽超时，避免与用例强度无关的偶发失败。
export default defineConfig({test:{testTimeout:30_000,hookTimeout:30_000}});