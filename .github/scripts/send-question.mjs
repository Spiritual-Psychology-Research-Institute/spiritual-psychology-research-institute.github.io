// PR 없이 끝난 요청에 대해 요청자에게 보내는 메일. 세 가지 경우가 있다.
//
// - ask:  무엇을 바꿔야 할지 몰라 되묻는다.
// - done: 요청한 내용이 이미 사이트에 있다.
// - note: Claude 가 표시 없이 댓글만 남겼다. 어느 쪽인지 모르므로
//         댓글만 그대로 전하고 앞뒤에 아무 판단도 덧붙이지 않는다.
//
// ask 와 done 을 한 틀에 넣으면 안 된다. "이미 반영되어 있습니다" 를
// "이해하지 못했습니다 ... 어떻게 바꾸고 싶으신지 알려주세요" 사이에 끼워
// 보냈더니, 요청자는 같은 요청을 세 번 다시 보냈다 (이슈 #22~24).
import nodemailer from "nodemailer";

const {
  MAIL_HOST = "smtp.gmail.com",
  MAIL_USER,
  MAIL_PASSWORD,
  REPLY_TO_EMAIL,
  NOTIFY_CC,
  REQUEST_TITLE,
  QUESTION,
  MODE = "ask",
  SITE_URL = "https://spiritual-psychology-research-institute.github.io/",
} = process.env;

if (!MAIL_USER || !MAIL_PASSWORD || !REPLY_TO_EMAIL) {
  console.log("메일 설정이 없어 건너뜁니다.");
  process.exit(0);
}

const note = (QUESTION || "").trim();

const done = MODE === "done";
const neutral = MODE === "note" && note;

const subject = done ? "요청하신 내용은 이미 홈페이지에 있습니다" : "홈페이지 수정 요청을 확인해 주세요";

const text = neutral
  ? [
      "메일 잘 받았습니다.",
      "",
      note,
      "",
      "홈페이지는 여기에서 보실 수 있습니다.",
      SITE_URL,
      "",
      "더 고칠 부분이 있으면 이 메일에 답장으로 알려주세요.",
      "",
      `· 보내주신 메일 제목: ${REQUEST_TITLE || "(제목 없음)"}`,
    ]
  : done
  ? [
      "메일 잘 받았습니다.",
      "",
      note || "요청하신 내용은 이미 홈페이지에 반영되어 있어서 따로 고친 것은 없습니다.",
      "",
      "홈페이지에서 직접 확인하실 수 있습니다.",
      SITE_URL,
      "",
      "예전 화면이 보이면 새로고침을 한 번 해주세요.",
      "휴대폰에서는 화면을 아래로 끌어내리면 새로고침이 됩니다.",
      "",
      "그래도 다르게 보이면, 보이는 화면을 사진으로 찍어 답장으로 보내주세요.",
      "",
      `· 보내주신 메일 제목: ${REQUEST_TITLE || "(제목 없음)"}`,
    ]
  : [
      "메일 잘 받았습니다. 그런데 요청하신 내용을 제가 정확히 이해하지 못했습니다.",
      "",
      note || "보내주신 내용만으로는 어느 부분을 어떻게 바꿔 드려야 할지 알기 어려웠습니다.",
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
      "  - \"소개 사진을 이걸로 바꿔주세요\" (사진을 첨부해 주세요)",
      "",
      `· 보내주신 메일 제목: ${REQUEST_TITLE || "(제목 없음)"}`,
    ];

const transport = nodemailer.createTransport({
  host: MAIL_HOST,
  port: 465,
  secure: true,
  auth: { user: MAIL_USER, pass: MAIL_PASSWORD },
});

await transport.sendMail({
  from: `"사이 연구소 홈페이지" <${MAIL_USER}>`,
  to: [REPLY_TO_EMAIL, ...(NOTIFY_CC ? [NOTIFY_CC] : [])].join(", "),
  subject,
  text: text.join("\n"),
});

console.log(`요청자에게 메일을 보냈습니다 (${neutral ? "note" : done ? "done" : "ask"}).`);
