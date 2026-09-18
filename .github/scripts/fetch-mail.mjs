// Poll a dedicated mailbox and turn each allowlisted message into a
// `site-request` issue. Attachments are pushed to the `site-inbox` branch so
// Claude can reach them without them ever landing on the live site.
//
// PRIVACY: this repo is public, so issue bodies and workflow logs are public.
// The sender's address is never written into the issue — only the request text
// the author intends for the site anyway.
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

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

try {
  const uids = await client.search({ seen: false }, { uid: true });
  console.log(uids?.length ? `${uids.length} unseen message(s)` : "no new mail");

  for (const uid of uids || []) {
    const { content } = await client.download(uid, undefined, { uid: true });
    const mail = await simpleParser(content);
    const from = (mail.from?.value?.[0]?.address || "").toLowerCase();

    // Mask before anything can echo it into a public log.
    if (from) console.log(`::add-mask::${from}`);

    if (!allowed.includes(from)) {
      console.log(`skipped: sender not on allowlist (uid ${uid})`);
      await markSeen(uid);
      continue;
    }

    const subject = (mail.subject || "제목 없음").trim().slice(0, 120);
    const text = (mail.text || "").trim().slice(0, 12000);
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
