// 요청을 이해하지 못했을 때 요청자에게 되묻는 메일.
//
// 지금까지는 Claude 가 PR 본문에 질문을 적었는데, 요청자는 GitHub 을 보지
// 않으므로 영영 답을 받지 못했다. 되묻기도 메일로 나가야 대화가 이어진다.
import nodemailer from "nodemailer";

const {
  MAIL_HOST = "smtp.gmail.com",
  MAIL_USER,
  MAIL_PASSWORD,
  REPLY_TO_EMAIL,
  NOTIFY_CC,
  REQUEST_TITLE,
  QUESTION,
  SITE_URL = "https://spiritual-psychology-research-institute.github.io/",
} = process.env;

if (!MAIL_USER || !MAIL_PASSWORD || !REPLY_TO_EMAIL) {
  console.log("메일 설정이 없어 건너뜁니다.");
  process.exit(0);
}

// Claude 가 남긴 질문이 있으면 그걸 쓰고, 없으면 기본 문구로 간다.
const body = (QUESTION || "").trim() ||
  "보내주신 내용만으로는 어느 부분을 어떻게 바꿔 드려야 할지 알기 어려웠습니다.";

const transport = nodemailer.createTransport({
  host: MAIL_HOST,
  port: 465,
  secure: true,
  auth: { user: MAIL_USER, pass: MAIL_PASSWORD },
});

await transport.sendMail({
  from: `"사이 연구소 홈페이지" <${MAIL_USER}>`,
  to: [REPLY_TO_EMAIL, ...(NOTIFY_CC ? [NOTIFY_CC] : [])].join(", "),
  subject: "홈페이지 수정 요청을 확인해 주세요",
  text: [
    "메일 잘 받았습니다. 그런데 요청하신 내용을 제가 정확히 이해하지 못했습니다.",
    "",
    body,
    "",
    "현재 홈페이지는 여기에서 보실 수 있습니다.",
    SITE_URL,
    "",
    "화면을 보시고, 어느 부분을 어떻게 바꾸고 싶으신지",
    "이 메일에 답장으로 알려주시면 그대로 반영하겠습니다.",
    "",
    "예를 들면 이런 식이면 충분합니다.",
    "  - \"소개 글 두 번째 줄을 ○○○ 로 바꿔주세요\"",
    "  - \"연구 섹션에 논문 하나 더 넣어주세요\" (제목과 초록을 같이 보내주세요)",
    "  - \"오시는 길에 주차 안내를 추가해주세요\"",
    "",
    `· 보내주신 메일 제목: ${REQUEST_TITLE || "(제목 없음)"}`,
  ].join("\n"),
});

console.log("되묻는 메일을 보냈습니다.");
