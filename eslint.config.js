// ESLint 配置：只收录「正确性」规则，不纳入风格与复杂度检查。
// 风格由 Prettier 负责；未使用变量/参数由 tsconfig 的 noUnusedLocals/noUnusedParameters 负责。
// type-aware 规则只跑在 tsconfig 覆盖的 src/ 上（tests/ 与配置脚本不在 tsconfig project 内）。
// 决议与验收口径见 issue #36。
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

const nodeGlobals = {
  process: "readonly",
  console: "readonly",
  Buffer: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  fetch: "readonly",
  AbortController: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  queueMicrotask: "readonly",
  structuredClone: "readonly",
};

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...js.configs.recommended,
    languageOptions: { globals: nodeGlobals },
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      // 未使用变量由 tsconfig 负责（issue #36 D2）。
      "@typescript-eslint/no-unused-vars": "off",
      // 显式 any / 非空断言等属风格取舍，不在本期范围（issue #36 D1–D3）。
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    rules: {
      // 两条 type-aware 正确性规则（issue #36 D1）。
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
);
