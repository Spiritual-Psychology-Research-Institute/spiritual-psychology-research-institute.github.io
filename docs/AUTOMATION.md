# 메일로 홈페이지 고치기 — 설정 안내

김윤희 박사가 메일 한 통 보내면 홈페이지가 수정되는 파이프라인입니다.

```
고모 ── 메일 ──▶ 전용 Gmail
                    │  mail-inbox.yml (15분마다)
                    ▼
               GitHub 이슈 (라벨: site-request)
                    │  site-request.yml
                    ▼
             Claude가 수정 → PR 생성
                    │
                    ▼
            사람이 확인하고 Merge ──▶ 자동 배포
                    │  notify-requester.yml
                    ▼
            고모에게 "반영됐습니다" 메일
```

**자동 머지는 없습니다.** 이 저장소는 `main` push가 곧 배포라서, 마지막 확인은
반드시 사람이 합니다. 나머지 안전장치는 전부 이 한 줄의 보조입니다.

---

## 1. 전용 Gmail 계정 만들기

기존 개인 메일을 쓰지 마세요. 앱 비밀번호를 GitHub에 넣어야 하므로 이 용도
전용 계정이 안전합니다. 예: `sai.site.bot@gmail.com`

만든 뒤:

1. 계정에 **2단계 인증**을 켭니다 (앱 비밀번호의 전제 조건입니다).
2. <https://myaccount.google.com/apppasswords> 에서 **앱 비밀번호**를 만듭니다.
   16자리 문자열이 나옵니다. 이게 `MAIL_PASSWORD` 입니다.
3. Gmail 설정 → **전달 및 POP/IMAP** → *IMAP 사용* 을 켭니다.

## 2. GitHub 토큰 만들기

<https://github.com/settings/tokens> 에서 **Fine-grained personal access
token**을 만듭니다.

- Repository access: 이 저장소만
- Permissions: `Issues: Read and write`, `Contents: Read and write`

> 왜 필요한가: 기본 `GITHUB_TOKEN`으로 만든 이슈는 **다른 워크플로를 트리거하지
> 않습니다.** GitHub의 무한 루프 방지 정책입니다. PAT로 만들어야 그다음
> 단계인 Claude 워크플로가 실행됩니다.

## 3. 저장소 시크릿 등록

Settings → Secrets and variables → Actions → *New repository secret*

| 이름 | 값 |
|---|---|
| `MAIL_USER` | 전용 Gmail 주소 |
| `MAIL_PASSWORD` | 위에서 만든 16자리 앱 비밀번호 |
| `ALLOWED_SENDERS` | 고모 메일 주소. 쉼표로 여러 개 가능 |
| `AUTOMATION_TOKEN` | 2번에서 만든 PAT |
| `ANTHROPIC_API_KEY` | <https://console.anthropic.com> 에서 발급 |

## 4. 동작 확인

1. Actions 탭 → **메일 수신함 확인** → *Run workflow* 로 수동 실행
2. 전용 주소로 아무 메일이나 보내보고 이슈가 생기는지 확인
3. 이슈에 `site-request` 라벨이 자동으로 붙고 PR이 열리는지 확인
4. PR을 머지하고 회신 메일이 오는지 확인

`site-request` 라벨은 이미 만들어 두었습니다.

## 5. 고모께 안내할 내용

이것만 알려드리면 됩니다.

> 홈페이지에서 고치고 싶은 게 있으면 `sai.site.bot@gmail.com` 으로 메일을
> 보내주세요. 형식 없이 평소 말씀하시듯 쓰시면 됩니다. 사진도 첨부하셔도 됩니다.
> 반영되면 답장으로 알려드립니다.

---

## 알아둘 것

### 이 저장소는 공개입니다

이슈 내용과 Actions 로그는 **누구나 볼 수 있습니다.** 그래서:

- 보낸 사람 주소는 이슈에 기록하지 않고, 로그에서도 `::add-mask::`로 가립니다.
- 하지만 **메일 본문은 이슈에 그대로 들어갑니다.** 어차피 홈페이지에 올릴
  내용이라 대부분 문제없지만, 개인적인 이야기를 같이 적으시면 공개됩니다.
- 더 엄격하게 하려면 자동화만 **비공개 저장소**로 분리하고 거기서 이 저장소에
  PR을 여는 구조로 바꾸면 됩니다. 필요해지면 그때 옮기는 게 낫습니다.

### 첨부파일

`site-inbox` 브랜치의 `inbox/` 아래에 올라갑니다. 이 브랜치는 배포와 무관하고,
`main`에 머지하지 않는 한 사이트에 나타나지 않습니다. 가끔 비워주세요.

### 비용

Claude API는 요청 한 건당 수십 원 수준입니다. GitHub Actions는 공개 저장소라
무료입니다. 15분 주기 폴링은 실행 시간이 거의 들지 않습니다.

### 요청이 빗나갈 때

이슈 본문은 신뢰할 수 없는 입력으로 취급합니다. Claude에게는 `index.html`,
`404.html`, `docs/` 외에는 건드리지 말라고 지시해 두었고 `.github/`는 금지입니다.
다만 **이건 지시일 뿐 강제가 아닙니다.** 실제 방어선은 PR 리뷰입니다.
머지 전에 diff를 꼭 보세요.
