// Close the loop: tell the requester, in plain Korean, that their change is
// live. Without this the requester has no way to know anything happened —
// they will never look at GitHub.
import nodemailer from "nodemailer";

const {
  MAIL_HOST = "smtp.gmail.com",
  MAIL_USER,
  MAIL_PASSWORD,
  REPLY_TO_EMAIL,
  PR_TITLE,
  PR_URL,
  SITE_URL = "https://spiritual-psychology-research-institute.github.io/",
} = process.env;

if (!MAIL_USER || !MAIL_PASSWORD || !REPLY_TO_EMAIL) {
  throw new Error("missing mail env");
}

const transport = nodemailer.createTransport({
  host: MAIL_HOST,
  port: 465,
  secure: true,
  auth: { user: MAIL_USER, pass: MAIL_PASSWORD },
});

await transport.sendMail({
  from: `"사이 연구소 홈페이지" <${MAIL_USER}>`,
  to: REPLY_TO_EMAIL,
  subject: "홈페이지 수정이 반영되었습니다",
  text: [
    "보내주신 요청대로 홈페이지를 수정했습니다.",
    "",
    `· 수정 내용: ${PR_TITLE || "(제목 없음)"}`,
    `· 홈페이지: ${SITE_URL}`,
    "",
    "반영까지 1~2분 정도 걸릴 수 있습니다.",
    "화면이 그대로면 새로고침을 한 번 해주세요.",
    "",
    "고칠 부분이 있으면 이 메일에 그냥 답장으로 알려주시면 됩니다.",
    "",
    `(작업 기록: ${PR_URL || "-"})`,
  ].join("\n"),
});

console.log("reply sent");
