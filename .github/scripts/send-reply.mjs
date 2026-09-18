// 결과를 사람에게 돌려준다.
// - 요청자(고모): "반영됐습니다" 평문 안내
// - 관리자(NOTIFY_CC): 무엇이 바뀌었는지 + PR 링크
// 자동 머지를 켜면 사람이 diff 를 보지 않으므로, 관리자 통지가
// 사후에 알아챌 수 있는 유일한 경로가 된다. 그래서 내용을 담아 보낸다.
import nodemailer from "nodemailer";

const {
  MAIL_HOST = "smtp.gmail.com",
  MAIL_USER,
  MAIL_PASSWORD,
  REPLY_TO_EMAIL,
  NOTIFY_CC,
  PR_TITLE,
  PR_URL,
  CHANGED_FILES,
  AUTO_MERGED,
  SITE_URL = "https://spiritual-psychology-research-institute.github.io/",
} = process.env;

if (!MAIL_USER || !MAIL_PASSWORD || !REPLY_TO_EMAIL) throw new Error("missing mail env");

const transport = nodemailer.createTransport({
  host: MAIL_HOST,
  port: 465,
  secure: true,
  auth: { user: MAIL_USER, pass: MAIL_PASSWORD },
});

const to = [REPLY_TO_EMAIL, ...(NOTIFY_CC ? [NOTIFY_CC] : [])].join(", ");

await transport.sendMail({
  from: `"사이 연구소 홈페이지" <${MAIL_USER}>`,
  to,
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
    "―――――――――――――――――――",
    "이하 관리자 확인용",
    "",
    `· 자동 머지: ${AUTO_MERGED === "true" ? "예 (검사 통과)" : "아니오 (사람이 머지)"}`,
    `· 바뀐 파일: ${CHANGED_FILES || "-"}`,
    `· 작업 기록: ${PR_URL || "-"}`,
    "",
    "되돌리려면 위 링크의 PR 에서 Revert 를 누르면 됩니다.",
  ].join("\n"),
});

console.log(`reply sent to ${to.split(",").length} recipient(s)`);
