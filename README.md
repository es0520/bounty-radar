# Bounty Radar

make.fun의 공개 API에서 접수 중인 소프트웨어·디자인·퍼즐·글쓰기 대회를 찾아, 상금과 참가 조건을 정리합니다. Node.js 22 이상에서 동작하며 별도 패키지, AI 모델, API 키를 사용하지 않습니다.

## 평가 방식

1. 공개 목록에서 개시 시각과 마감 시각을 확인하고 관련 분야를 선별합니다. 마감이 가까운 후보부터 한 번에 최대 16건의 상세 정보와 공식 참가 요건을 조회합니다.
2. 마감, 참가비, 상금 총액과 1위 상금, 유상 순위 수, 제출 건수, 필수 도구, 봉인된 세션 기록 여부를 정리합니다. 보안 공격이나 거래가 필요한 공모는 범위에서 제외합니다.
3. 조건이 확인된 무료 공모는 `shortlist`, 불명확한 조건이나 추가 확인 항목이 있는 공모는 `review`, 유료이거나 종료된 공모는 `skip`으로 표시합니다. 같은 상태에서는 1위 상금과 마감 순으로 정렬합니다. 제출 건수는 경쟁 규모를 가늠하는 참고값입니다. 수익과 당첨 확률은 산출하지 않습니다.

보고서의 공식 요건 링크에서 AI 사용·공개 요건, 참가 자격, 필수 도구와 실제 비용을 확인할 수 있습니다. 스캐너는 make.fun에 공개 GET 요청만 보내며, 공모전 참가·제출, 계정 생성, 지갑 서명, 결제 기능을 포함하지 않습니다.

## 실행

로컬 확인은 이 폴더에서 `node radar.mjs`로 실행합니다.

클라우드에서는 이 폴더의 파일을 승인된 공개 GitHub 저장소의 기본 브랜치에 올립니다. 숨김 폴더인 `.github`도 포함합니다. 첫 실행은 **Actions → Bounty radar → Run workflow**에서 시작하며, 실행 상세 화면의 **Summary**에서 보고서를 봅니다.

이후 매일 한국 시간 09:17과 21:17에 GitHub의 표준 Linux 실행 환경에서 동작하므로 PC 전원을 꺼도 됩니다. 공개 저장소의 표준 실행 환경은 무료이며 워크플로는 비공개 저장소에서 스캔을 건너뜁니다. 실행은 최대 8분으로 제한되며, 보고서에는 GitHub의 기본 실행 요약만 사용합니다. GitHub는 부하에 따라 예약 실행을 지연하거나 누락할 수 있으며, 공개 저장소에서 60일간 활동이 없으면 예약을 비활성화할 수 있습니다. 중단하려면 **Actions → Bounty radar → … → Disable workflow**를 선택합니다.

- [make.fun 공개 API와 요건 필드](https://make.fun/skill.md)
- [GitHub Actions 무료 사용 범위](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [GitHub 예약 실행 조건](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
