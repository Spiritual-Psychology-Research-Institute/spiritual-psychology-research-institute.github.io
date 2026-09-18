// 디자인 토큰 조합의 명도 대비를 계산한다.
//
// CLAUDE.md 가 접근성을 일급 관심사로 못박고 있는데, 사람 리뷰 없이
// 자동 배포되는 구조에서는 색 변경이 조용히 대비를 깨뜨릴 수 있다.
// 절대 기준으로 막지는 않는다 - 기존에도 미달 조합이 있어 무관한 요청까지
// 전부 걸린다. 대신 "나빠졌는가" 를 본다.

const toRgb = (h) => {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const channel = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = (hex) => {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// 실제로 화면에서 겹치는 조합만 본다.
export const PAIRS = [
  ["ink", "bg"], ["ink", "paper"], ["ink-soft", "paper"], ["muted", "paper"],
  ["muted", "bg"], ["moss-deep", "bg"], ["moss-deep", "paper"], ["terra", "paper"],
  ["gold", "moss-deep"], ["gold-light", "moss-deep"], ["moss-mid", "moss-deep"],
  ["gold-pale", "moss-deep"],
];

export const tokensOf = (src) =>
  Object.fromEntries([...src.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})/g)].map((m) => [m[1], m[2]]));

export const ratios = (src) => {
  const t = tokensOf(src);
  const out = {};
  for (const [fg, bg] of PAIRS) {
    if (!t[fg] || !t[bg]) continue;
    out[`--${fg} on --${bg}`] = { ratio: contrast(t[fg], t[bg]), hex: `${t[fg]} / ${t[bg]}` };
  }
  return out;
};

// 직접 실행하면 현재 상태를 표로 출력한다.
// (경로 정규화에 역슬래시 리터럴을 쓰지 않으려고 파일명으로 판별한다)
if ((process.argv[1] || "").endsWith("check-contrast.mjs")) {
  const fs = await import("node:fs");
  const r = ratios(fs.readFileSync("index.html", "utf8"));
  console.log("| 조합 | 색 | 대비 | 작은글씨 4.5:1 | 큰글씨 3:1 |");
  console.log("|---|---|---|---|---|");
  for (const [k, v] of Object.entries(r)) {
    console.log(`| ${k} | ${v.hex} | ${v.ratio.toFixed(2)}:1 | ${v.ratio >= 4.5 ? "통과" : "미달"} | ${v.ratio >= 3 ? "통과" : "미달"} |`);
  }
}
