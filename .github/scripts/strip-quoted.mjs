// 답장에서 인용된 원문을 걷어낸다.
//
// 회신 메일에 "고칠 부분이 있으면 답장 주세요" 라고 안내하므로 답장이
// 들어오는 것은 정상 경로다. 그런데 답장 본문에는 이전 메일 전체가
// 인용되어 따라온다. 그대로 이슈에 넣으면 Claude 가 이전 요청을 새 요청으로
// 오해하거나, 자기가 보낸 안내문을 지시로 읽을 수 있다.
//
// 인용 시작 지점에서 자르고, 남은 인용 줄을 버린다.

const CUT_PATTERNS = [
  /^-{2,}\s*(original message|원본 메시지|원본 메일|이전 메일)/i,  // 한메일은 "원본 메일"
  /^_{5,}$/,
  /^-{5,}$/,
  /^―{5,}$/,                                   // 우리 알림 메일의 구분선
  /^\s*\d{4}년\s*\d{1,2}월\s*\d{1,2}일.*(작성|씀|님이)/,  // Gmail 한국어
  /^\s*On\s.+\swrote:\s*$/i,                    // Gmail 영어
  /^\s*보낸\s*사람\s*[:：]/,                     // Daum/Hanmail
  /^\s*From\s*[:：].+@/i,
  /^\s*이하\s*관리자\s*확인용\s*$/,               // 우리 알림 메일 꼬리
];

export function stripQuoted(text) {
  const lines = (text || "").split(/\r?\n/);
  const out = [];

  for (const line of lines) {
    if (CUT_PATTERNS.some((re) => re.test(line))) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }

  // 잘라낸 뒤 남은 앞뒤 빈 줄 정리
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();

  return out.join("\n");
}
