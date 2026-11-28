import { describe, it, expect } from "vitest";
import { truncateText } from "../src/core/text.js";
import { countLoneSurrogates } from "./support/lone-surrogates.js";

describe("truncateText", () => {
  it("returns short text unchanged without an ellipsis", () => {
    expect(truncateText("中文 emoji 😀", 100)).toBe("中文 emoji 😀");
    expect(truncateText("abc", 3)).toBe("abc");
    expect(truncateText("😀😀😀", 3)).toBe("😀😀😀");
  });
  it("counts code points so an emoji at the limit stays whole", () => {
    const text = "a".repeat(199) + "😀" + "b".repeat(30);
    const truncated = truncateText(text, 200);
    expect(truncated).toBe("a".repeat(199) + "😀…");
    expect(Array.from(truncated)).toHaveLength(201);
    expect(countLoneSurrogates(truncated)).toBe(0);
  });
  it("counts Chinese characters and emoji by code point", () => {
    const text = "中".repeat(200) + "😀" + "文".repeat(9);
    const truncated = truncateText(text, 200);
    expect(truncated).toBe("中".repeat(200) + "…");
    expect(countLoneSurrogates(truncated)).toBe(0);
  });
  it("never splits a surrogate pair at the limit boundary", () => {
    expect(truncateText("😀".repeat(10), 5)).toBe("😀".repeat(5) + "…");
    expect(truncateText("😀ab", 1)).toBe("😀…");
    expect(truncateText("中ab", 1)).toBe("中…");
    for (const text of ["😀".repeat(10), "😀ab", "中😀文😀", "😀"])
      expect(countLoneSurrogates(truncateText(text, 1))).toBe(0);
  });
  it("handles zero and non-positive limits without crashing", () => {
    expect(truncateText("abc", 0)).toBe("…");
    expect(truncateText("😀", 0)).toBe("…");
    expect(truncateText("abc", -1)).toBe("…");
    expect(truncateText("", 0)).toBe("");
    expect(countLoneSurrogates(truncateText("😀", 0))).toBe(0);
  });
  it("supports a custom suffix for verbatim prefixes", () => {
    expect(truncateText("😀😀😀", 2, "")).toBe("😀😀");
    expect(truncateText("a".repeat(300), 240, "")).toBe("a".repeat(240));
    expect(truncateText("短文本", 10, "")).toBe("短文本");
  });
});
