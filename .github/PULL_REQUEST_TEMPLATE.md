<!--
标题格式：<type>(<scope>): <主题>；契约改动需在标题注明契约影响。常用 type：feat / fix / docs / style / test / improve / integration / project。
Title format: <type>(<scope>): <topic>. Note contract impact in the title when applicable.
-->

## 做了什么 / What was done

<!-- 一两句话概述本次改动解决的问题。One or two sentences on the problem this change solves. -->

## 改动 / Changes

<!-- 列出主要改动点（文件 / 模块 / 行为变化）。List the main changes (files / modules / behavior changes). -->

## 验证 / Verification

<!-- 粘贴本地 `npm run preflight` 结果（tsc / vitest 汇总行 / build / smoke / format:check）。CI 暂停期间以本地结果为准。
Paste local `npm run preflight` results (tsc / vitest summary / build / smoke / format:check). Local results are authoritative while CI is paused. -->

- [ ] `npm run preflight` 全部通过 / fully passed
- [ ] 行为改动带测试；契约改动已同步文档与生成 schema / behavior changes carry tests; contract changes synced docs and generated schemas
- [ ] 未包含真实会议内容、个人信息或凭据 / no real meeting content, personal information, or credentials included

## 范围 / Scope

<!-- 明确本次「不做什么」，避免范围蔓延。State what is explicitly NOT done to keep the change scoped. -->

## 关联 issue / Related issues

<!-- 如关联 issue，写 `#编号`；跨模块行为修复需在提交信息中引用。Reference issues with `#n`; cross-module behavior fixes must reference issues in commit messages. -->
