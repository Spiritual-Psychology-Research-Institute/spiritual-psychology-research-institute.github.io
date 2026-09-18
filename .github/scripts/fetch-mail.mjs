// Poll a dedicated mailbox and turn each allowlisted message into a
// `site-request` issue. Attachments are pushed to the `site-inbox` branch so
// Claude can reach them without them ever landing on the live site.
//
// PRIVACY: this repo is public, so issue bodies and workflow logs are public.
// The sender's address is never written into the issue — only the request text
// the author intends for the site anyway.
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { stripQuoted } from "./strip-quoted.mjs";

const {
  MAIL_HOST = "imap.gmail.com",
  MAIL_PORT = "993",
  MAIL_USER,
  MAIL_PASSWORD,
  ALLOWED_SENDERS,
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
} = process.env;

for (const [k, v] of Object.entries({ MAIL_USER, MAIL_PASSWORD, ALLOWED_SENDERS, GITHUB_TOKEN })) {
  if (!v) throw new Error(`missing env: ${k}`);
}

const ATTACH_BRANCH = "site-inbox";
// 한 번의 폴링에서 만드는 이슈 수 상한. 메일이 한꺼번에 몰리면 Claude 실행이
// 그만큼 동시에 뜨고 비용도 같이 뛴다. 넘친 메일은 읽지 않은 채로 두므로
// 다음 폴링에서 이어서 처리된다.
const MAX_PER_RUN = 3;
const MAX_ATTACH_BYTES = 8 * 1024 * 1024;
// IMAP system flag. Built from a char code because the literal
// backslash does not survive every editing path reliably.
const SEEN = String.fromCharCode(92) + "Seen";
const allowed = ALLOWED_SENDERS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const gh = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`GitHub ${init.method || "GET"} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res.status === 404 ? null : res.json();
};

const ensureBranch = async () => {
  if (await gh(`/git/ref/heads/${ATTACH_BRANCH}`)) return;
  const repo = await gh("");
  const base = await gh(`/git/ref/heads/${repo.default_branch}`);
  await gh("/git/refs", {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${ATTACH_BRANCH}`, sha: base.object.sha }),
  });
  console.log(`created branch ${ATTACH_BRANCH}`);
};

const slug = (s) =>
  (s || "file").normalize("NFC").replace(/[^\w.가-힣-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";

const client = new ImapFlow({
  host: MAIL_HOST,
  port: Number(MAIL_PORT),
  secure: true,
  auth: { user: MAIL_USER, pass: MAIL_PASSWORD },
  logger: false,
});

// Every message address below is a UID. ImapFlow defaults to sequence numbers,
// which shift as the mailbox changes — a seen-flag written against a stale
// sequence number lands on the wrong message and the original gets processed
// again on the next run, creating duplicate issues.
const markSeen = async (uid) => {
  const ok = await client.messageFlagsAdd(uid, [SEEN], { uid: true });
  if (!ok) console.log(`::warning::uid ${uid} 읽음 처리 실패 - 다음 실행에서 중복될 수 있습니다`);
  return ok;
};

await client.connect();
const lock = await client.getMailboxLock("INBOX");
let created = 0;
let hitCap = false;

try {
  const uids = await client.search({ seen: false }, { uid: true });
  console.log(uids?.length ? `${uids.length} unseen message(s)` : "no new mail");

  for (const uid of uids || []) {
    if (created >= MAX_PER_RUN) {
      console.log(`이번 실행 상한(${MAX_PER_RUN}건) 도달 - 남은 메일은 이어서 처리합니다.`);
      hitCap = true;
      break;
    }

    const { content } = await client.download(uid, undefined, { uid: true });
    const mail = await simpleParser(content);
    const from = (mail.from?.value?.[0]?.address || "").toLowerCase();

    // Mask before anything can echo it into a public log.
    if (from) console.log(`::add-mask::${from}`);

    if (!allowed.includes(from)) {
      // 전체 주소는 공개 로그에 남길 수 없지만, 아무 힌트도 없으면 주소가
      // 틀렸는지 알아내려고 메일함을 직접 열어봐야 한다. 앞 두 글자와
      // 도메인만 남긴다.
      const at = from.indexOf("@");
      const hint = at > 0 ? `${from.slice(0, 2)}***${from.slice(at)}` : "(발신자 없음)";
      console.log(`skipped: 화이트리스트에 없는 발신자 ${hint} (uid ${uid})`);
      await markSeen(uid);
      continue;
    }

    const subject = (mail.subject || "제목 없음").trim().slice(0, 120);
    // 답장이면 인용된 원문을 걷어낸다. 그대로 두면 Claude 가 이전 요청을
    // 새 요청으로 오해하거나 우리가 보낸 안내문을 지시로 읽는다.
    const text = stripQuoted(mail.text || "").trim().slice(0, 12000);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    const links = [];
    for (const att of mail.attachments || []) {
      if (!att.content || att.size > MAX_ATTACH_BYTES) {
        links.push(`- ⚠️ \`${att.filename}\` — 너무 크거나 비어 있어 건너뜀`);
        continue;
      }
      await ensureBranch();
      const path = `inbox/${stamp}/${slug(att.filename)}`;
      await gh(`/contents/${encodeURI(path)}`, {
        method: "PUT",
        body: JSON.stringify({
          message: `inbox: ${path}`,
          content: att.content.toString("base64"),
          branch: ATTACH_BRANCH,
        }),
      });
      links.push(`- \`${path}\` (브랜치 \`${ATTACH_BRANCH}\`)`);
    }

    const body = [
      "> 메일로 접수된 사이트 수정 요청입니다. 보낸 사람 주소는 기록하지 않습니다.",
      "",
      "## 요청 내용",
      "",
      text || "_(본문 없음)_",
      "",
      links.length ? `## 첨부\n\n${links.join("\n")}` : "",
      "",
      "---",
      "`site-request` 라벨이 붙으면 Claude가 PR을 만듭니다.",
      "CI 검사를 통과하면 사람 확인 없이 자동 머지됩니다.",
    ].join("\n");

    const issue = await gh("/issues", {
      method: "POST",
      body: JSON.stringify({ title: `[요청] ${subject}`, body, labels: ["site-request"] }),
    });
    console.log(`created issue #${issue.number}`);
    created += 1;

    await markSeen(uid);
  }
} finally {
  lock.release();
  await client.logout();
}

console.log(`done: ${created} issue(s) created`);

// 상한에 걸려 남은 메일이 있으면 스스로 한 번 더 깨운다.
// GitHub 예약 실행이 몇 시간씩 밀릴 수 있어, 다음 크론을 기다리면
// 남은 요청이 그만큼 묵는다. 처리한 메일은 읽음으로 표시되므로
// 매 회차가 전진하고 무한 반복되지 않는다.
if (hitCap) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/dispatches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ event_type: "check-mail" }),
  });
  console.log(res.ok ? "남은 메일 처리를 위해 다음 실행을 예약했습니다." : `::warning::후속 실행 예약 실패 (${res.status})`);
}
