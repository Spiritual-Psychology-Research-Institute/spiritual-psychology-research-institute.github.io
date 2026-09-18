// Claude 가 만든 PR 을 찾는다.
//
// 브랜치 이름으로는 찾을 수 없다. 액션의 branch_prefix 는 액션이 직접
// 브랜치를 만드는 경우에만 적용되고, 프롬프트를 준 에이전트 모드에서는
// Claude 가 자기 방식대로 이름을 짓는다 (예: fix/research-footnote-issue-5).
// 그래서 PR 본문의 이슈 참조로 찾는다.
//
// 셸 안에서 jq 정규식을 쓰면 이스케이프가 깨지므로 여기서 처리한다.
import fs from "node:fs";

const { GITHUB_TOKEN, GITHUB_REPOSITORY, ISSUE, GITHUB_OUTPUT } = process.env;
if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !ISSUE) throw new Error("missing env");

const res = await fetch(
  `https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls?state=open&sort=created&direction=desc&per_page=50`,
  { headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: "application/vnd.github+json" } },
);
if (!res.ok) throw new Error(`GitHub ${res.status} ${await res.text()}`);

// "#5" 는 맞고 "#50" 은 아니다.
const ref = new RegExp("#" + ISSUE + "(?![0-9])");
const hit = (await res.json()).find((pr) => ref.test(pr.body || ""));

if (hit) console.log(`PR #${hit.number} (${hit.head.ref}) 을 찾았습니다.`);
else console.log(`::warning::이슈 #${ISSUE} 를 참조하는 열린 PR 이 없습니다.`);

if (GITHUB_OUTPUT) fs.appendFileSync(GITHUB_OUTPUT, `pr=${hit ? hit.number : ""}\n`);
