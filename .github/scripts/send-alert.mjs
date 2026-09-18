// 자동화가 실패했을 때 관리자에게 알린다.
// 이게 없으면 자리를 비운 동안 파이프라인이 죽어도 아무도 모르고,
// 요청자는 답이 없는 이유를 알 수 없다. 침묵이 정상과 구분되지 않는 게
// 무인 운영에서 가장 위험하다.
import nodemailer from "nodemailer";

const {
  MAIL_HOST = "smtp.gmail.com",
  MAIL_USER,
  MAIL_PASSWORD,
  ALERT_TO,
  WORKFLOW_NAME,
  RUN_URL,
  ISSUE_URL,
} = process.env;

if (!MAIL_USER || !MAIL_PASSWORD || !ALERT_TO) {
  console.log("메일 설정이 없어 알림을 건너뜁니다.");
  process.exit(0);
}

const transport = nodemailer.createTransport({
  host: MAIL_HOST,
  port: 465,
  secure: true,
  auth: { user: MAIL_USER, pass: MAIL_PASSWORD },
});

await transport.sendMail({
  from: `"사이 연구소 홈페이지" <${MAIL_USER}>`,
  to: ALERT_TO,
  subject: `[확인 필요] 홈페이지 자동화 실패 — ${WORKFLOW_NAME || "알 수 없음"}`,
  text: [
    "홈페이지 자동화가 실패했습니다. 요청자에게는 아무 답도 가지 않았습니다.",
    "",
    `· 워크플로: ${WORKFLOW_NAME || "-"}`,
    `· 실행 기록: ${RUN_URL || "-"}`,
    ISSUE_URL ? `· 관련 이슈: ${ISSUE_URL}` : "",
    "",
    "자주 있는 원인:",
    "- Gmail 앱 비밀번호가 바뀌었거나 폐기됨 (MAIL_PASSWORD)",
    "- Anthropic API 크레딧 소진 또는 키 폐기 (ANTHROPIC_API_KEY)",
    "- PAT 만료 (AUTOMATION_TOKEN)",
    "",
    "위 실행 기록 링크를 열면 실패한 단계와 오류가 보입니다.",
  ].filter(Boolean).join("\n"),
});

console.log("alert sent");
