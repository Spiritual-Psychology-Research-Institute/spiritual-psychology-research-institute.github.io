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

**검사를 통과하면 자동 머지됩니다.** 사람 승인 단계는 없습니다. 대신 머지 전
CI 검사가 관문입니다 (`.github/scripts/validate-site.mjs`).

검사가 보는 것:

- 바뀐 파일이 `index.html` / `404.html` / `docs/` 안인가.
  프롬프트에 적은 파일 제한은 지시일 뿐이므로 여기서 실제로 강제합니다.
- `div` 태그 균형
- 섹션 id / nav 링크 / JS `sections` 배열 세 곳의 일치

하나라도 걸리면 머지하지 않고 PR 을 열어둔 채 코멘트를 답니다.
머지되면 요청자와 관리자 모두에게 바뀐 파일 목록과 되돌리는 방법을
메일로 보냅니다. 되돌리기는 해당 PR 에서 Revert 를 누르면 됩니다.

---

## 1. 전용 Gmail 계정 만들기

기존 개인 메일을 쓰지 마세요. 앱 비밀번호를 GitHub에 넣어야 하므로 이 용도
전용 계정이 안전합니다. 예: `sai.site.bot@gmail.com`

만든 뒤:

1. 계정에 **2단계 인증**을 켭니다.
   <https://myaccount.google.com/signinoptions/twosv>
   앱 비밀번호의 전제 조건입니다. 2단계 인증이 꺼져 있으면 앱 비밀번호 메뉴가
   아예 나타나지 않고 "설정을 사용할 수 없습니다"만 뜹니다.
   두 번째 단계로 전화번호나 인증앱 중 하나를 등록해야 합니다.
2. <https://myaccount.google.com/apppasswords> 에서 **앱 비밀번호**를 만듭니다.
   16자리 문자열이 나옵니다. 이게 `MAIL_PASSWORD` 입니다.
   창을 닫으면 다시 볼 수 없으니 바로 GitHub 시크릿에 넣으세요.

> IMAP은 따로 켤 필요가 없습니다. Google이 개인 Gmail 계정의 IMAP 토글을
> 없애고 상시 활성으로 바꿨습니다. 설정 화면의 *전달 및 POP/IMAP* 탭에도
> 켜기/끄기 라디오가 더 이상 없습니다.

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

0. 시크릿이 하나라도 비어 있으면 워크플로는 실패하지 않고 조용히 건너뜁니다.
   로그에 `시크릿이 아직 설정되지 않아 건너뜁니다` 가 찍히면 아직 덜 넣은 겁니다.
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

## 자리를 비운 사이에도 도는가

메일 확인은 GitHub 예약 실행(cron)이 15분 간격으로 돌립니다. PC 를 꺼두어도
GitHub 서버에서 실행되므로 상관없습니다.

다만 **GitHub 예약 실행은 보장된 시각이 아닙니다.** 부하가 몰리면 지연되거나
건너뜁니다. 그래서 두 가지를 해두었습니다.

- 실행 시각을 매시 `:07 :22 :37 :52` 로 두었습니다. 정각 부근이 가장 혼잡해서
  `*/15` 처럼 `:00` 을 때리는 설정은 밀리기 쉽습니다.
- 즉시 깨우는 경로를 열어두었습니다. 아래 한 줄이면 예약을 기다리지 않고
  바로 메일함을 확인합니다.

  ```sh
  gh api repos/:owner/:repo/dispatches -f event_type=check-mail
  ```

급한 수정이라 지금 당장 반영되어야 한다면 이 명령을 쓰거나, Actions 탭에서
**메일 수신함 확인 → Run workflow** 를 누르면 됩니다.

### 더 확실하게 하려면 — Gmail 이 직접 깨우기

GitHub 예약이 계속 밀리면, Gmail 쪽에서 밀어주는 방식으로 바꿀 수 있습니다.
폴링이 사라지고 메일 도착 후 1분 안에 처리됩니다.

1. <https://script.google.com> 에서 새 프로젝트를 만듭니다
   (반드시 `kakwaksai@gmail.com` 으로 로그인한 상태에서).
2. 아래 코드를 붙여넣습니다.

   ```javascript
   const REPO = 'Spiritual-Psychology-Research-Institute/spiritual-psychology-research-institute.github.io';

   function checkMail() {
     // 안 읽은 메일이 있을 때만 GitHub 을 깨운다.
     if (GmailApp.search('is:unread in:inbox', 0, 1).length === 0) return;

     UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
       method: 'post',
       contentType: 'application/json',
       headers: {
         Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('GH_TOKEN'),
         Accept: 'application/vnd.github+json',
       },
       payload: JSON.stringify({ event_type: 'check-mail' }),
       muteHttpExceptions: true,
     });
   }
   ```

3. 프로젝트 설정 → **스크립트 속성**에 `GH_TOKEN` 을 추가하고 값으로
   `AUTOMATION_TOKEN` 과 같은 PAT 를 넣습니다.
4. 트리거 → **트리거 추가** → `checkMail` / 시간 기반 / 분 단위 타이머 /
   1분마다.

GitHub 예약 실행은 그대로 두어도 됩니다. 둘 다 돌아도 같은 메일을 두 번
처리하지 않습니다 — 처리한 메일은 읽음으로 표시되고, `concurrency` 설정이
동시 실행을 막습니다.

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

### 실패하면 알려줍니다

메일 확인이나 수정 작업이 실패하면 `kakwak123@gmail.com` 으로 알림 메일이
갑니다. 무인 운영에서 가장 위험한 건 침묵이 정상과 구분되지 않는 것이라,
파이프라인이 죽으면 반드시 티가 나게 해두었습니다. 흔한 원인은 앱 비밀번호
폐기, API 크레딧 소진, PAT 만료입니다.

### 요청이 빗나갈 때

이슈 본문은 신뢰할 수 없는 입력으로 취급합니다. Claude에게는 `index.html`,
`404.html`, `docs/` 외에는 건드리지 말라고 지시해 두었고 `.github/`는 금지입니다.
다만 **이건 지시일 뿐 강제가 아닙니다.** 실제 방어선은 PR 리뷰입니다.
머지 전에 diff를 꼭 보세요.
