import { z } from "zod";

export function countJapaneseGraphemes(text: string): number {
  if (!globalThis.Intl?.Segmenter) {
    console.warn(
      "[countJapaneseGraphemes] Intl.Segmenter is not supported in this environment. " +
        "Falling back to simple length count. Results may be inaccurate for complex characters."
    );
    return Array.from(text).length;
  }

  const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
  const segments = segmenter.segment(text);
  return Array.from(segments).length;
}

export const countJapaneseCharsToolConfig = {
  name: "countJapaneseChars",
  title: "日本語文字数カウント",
  description:
    "日本語テキストの文字数（グラフェム単位）を正確にカウントします。" +
    "サロゲートペア、結合文字、絵文字などの複雑な文字も正しく処理します。",
  inputSchema: {
    text: z.string().describe("カウントする日本語テキスト"),
  },
  annotations: {
    readOnlyHint: true,
  },
};

export async function countJapaneseCharsHandler({ text }: { text: string }) {
  const count = countJapaneseGraphemes(text);
  const result = {
    count,
    text,
    graphemeCount: count,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: `文字数: ${count}`,
      },
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
