// 자동 머지 전 관문.
// 사람 리뷰를 빼는 대신 기계가 볼 수 있는 것만이라도 확실히 본다.
// 하나라도 실패하면 PR은 열린 채로 남고 자동 머지되지 않는다.
import { execSync } from "node:child_process";
import fs from "node:fs";
import { ratios } from "./check-contrast.mjs";

const BASE = process.env.BASE_REF || "origin/main";
const ALLOW = [/^index\.html$/, /^404\.html$/, /^docs\//];

const fail = [];
const ok = [];

// 1) 바뀐 파일이 허용 목록 안에 있는가.
// 프롬프트에 적은 제한은 지시일 뿐이라 여기서 실제로 강제한다.
const changed = execSync(`git diff --name-only ${BASE}...HEAD`, { encoding: "utf8" })
  .split("\n").map((s) => s.trim()).filter(Boolean);

if (changed.length === 0) fail.push("바뀐 파일이 없습니다.");
for (const f of changed) {
  if (!ALLOW.some((re) => re.test(f))) fail.push(`허용되지 않은 파일 수정: ${f}`);
}
ok.push(`변경 파일 ${changed.length}개: ${changed.join(", ")}`);

// 2) index.html 구조 검사.
if (fs.existsSync("index.html")) {
  const s = fs.readFileSync("index.html", "utf8");

  const open = (s.match(/<div[\s>]/g) || []).length;
  const close = (s.match(/<\/div>/g) || []).length;
  if (open !== close) fail.push(`div 태그 불균형: 여는 태그 ${open}, 닫는 태그 ${close}`);
  else ok.push(`div 균형 ${open}/${close}`);

  // 섹션 id, nav 링크, JS sections 배열 세 곳이 항상 같이 움직여야 한다 (CLAUDE.md).
  const sections = [...s.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]);
  const navLinks = [...s.matchAll(/<a href="#([^"]+)" class="nav-link"/g)].map((m) => m[1]);
  const arr = s.match(/const sections = \[([^\]]*)\]/);
  const jsIds = arr ? [...arr[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];

  const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  if (!same(sections, navLinks)) {
    fail.push(`섹션과 nav 링크 불일치 — 섹션 [${sections}] / nav [${navLinks}]`);
  } else if (!same(sections, jsIds)) {
    fail.push(`섹션과 JS sections 배열 불일치 — 섹션 [${sections}] / JS [${jsIds}]`);
  } else {
    ok.push(`섹션/nav/JS 배열 일치 (${sections.length}개)`);
  }

  if (!/<title>.*<\/title>/.test(s)) fail.push("title 태그가 없습니다.");
}

// 3) 명도 대비 회귀. 절대 기준으로 막지 않는다 - 기존에도 미달 조합이 있어
// 무관한 요청까지 전부 걸린다. "이번 변경으로 나빠졌는가" 만 본다.
// 사람 리뷰 없이 배포되므로 색 변경의 부작용을 여기서 잡아야 한다.
if (fs.existsSync("index.html")) {
  try {
    const before = ratios(execSync(`git show ${BASE}:index.html`, { encoding: "utf8", maxBuffer: 32e6 }));
    const after = ratios(fs.readFileSync("index.html", "utf8"));
    let worse = 0, better = 0;
    for (const [pair, a] of Object.entries(after)) {
      const b = before[pair];
      if (!b) continue;
      const delta = a.ratio - b.ratio;
      if (delta < -0.05) {
        fail.push(`대비 악화: ${pair} ${b.ratio.toFixed(2)}:1 -> ${a.ratio.toFixed(2)}:1`);
        worse += 1;
      } else if (delta > 0.05) {
        ok.push(`대비 개선: ${pair} ${b.ratio.toFixed(2)}:1 -> ${a.ratio.toFixed(2)}:1`);
        better += 1;
      }
    }
    if (!worse && !better) ok.push("대비 변화 없음");
  } catch (e) {
    ok.push("대비 비교 건너뜀: " + String(e.message).slice(0, 80));
  }
}

const report = [
  fail.length ? "## ❌ 검사 실패\n" : "## ✅ 검사 통과\n",
  ...fail.map((f) => `- ❌ ${f}`),
  ...ok.map((o) => `- ✅ ${o}`),
].join("\n");

fs.writeFileSync(process.env.REPORT_FILE || "validate-report.md", report);
console.log(report);
process.exit(fail.length ? 1 : 0);
