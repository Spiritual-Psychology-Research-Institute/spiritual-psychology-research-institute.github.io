// 자동 머지 전 관문.
// 사람 리뷰를 빼는 대신 기계가 볼 수 있는 것만이라도 확실히 본다.
// 하나라도 실패하면 PR은 열린 채로 남고 자동 머지되지 않는다.
import { execSync } from "node:child_process";
import fs from "node:fs";

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

const report = [
  fail.length ? "## ❌ 검사 실패\n" : "## ✅ 검사 통과\n",
  ...fail.map((f) => `- ❌ ${f}`),
  ...ok.map((o) => `- ✅ ${o}`),
].join("\n");

fs.writeFileSync(process.env.REPORT_FILE || "validate-report.md", report);
console.log(report);
process.exit(fail.length ? 1 : 0);
