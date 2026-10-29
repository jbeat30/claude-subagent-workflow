# 검사 방법

이 저장소의 검사는 두 층으로 나뉨
정적 검사·단위 테스트의 통과는 워크플로의 권한 차단·위임 정확도·프롬프트 품질의 입증이 아니며, 실제 Claude 실행 결과와 구분해 보고

| 층 | 명령 | 비용 | CI | 확인하는 것 |
| --- | --- | --- | --- | --- |
| 정적 검사·단위 테스트 | `npm test` | 없음 | 실행 | 배포 원본 구조, 역할 정의 규칙, 검사 실행기·가드·설치 스크립트의 동작 |
| 실제 Claude 측정(소규모) | `node tools/eval/run-eval.mjs` | 사용 한도·비용 발생 | 미실행 | 위임·가드·보고 등 실제 행동, 비용·시간·토큰 |
| 실제 Claude 측정(어려운 과제) | `node tools/eval/hard/run.mjs` | 사용 한도·비용 발생 | 미실행 | 놓친 요구, 깨진 호출처, 범위 이탈, 허위 성공, 주입 수용을 코드로 채점 |

## 1. 정적 검사·단위 테스트

요구 사항: Node 20 이상, 외부 의존성 없음

```sh
npm test
```

| 구성 | 내용 |
| --- | --- |
| `tools/validate-template.mjs` | `template/` 구조, 역할 파일의 도구 상한·참조·필수 문구 검사 |
| `tools/subagent-check.test.mjs` | 검사 실행기 `run`·`verify`·`diff`·`trace` |
| `tools/subagent-guard.test.mjs` | 가드 hook의 허용·거부 판정, relay 모드 |
| `tools/install.test.mjs` | 설치 `detect`·`plan`·`apply`·`verify`·`remove`, 기존 설정 보존, 갱신·재설치 |
| `tools/subagent-approval.test.mjs` | 엄격 모드 승인 흐름 |

- 변경한 뒤 PR 전에 항상 실행, CI도 같은 명령을 Ubuntu·Windows(Node 20)에서 실행
- 역할 정의를 바꾸면 `tools/validate-template.mjs`의 도구 상한·참조 검사를 함께 갱신

## 2. 실제 Claude 측정

같은 과제를 조건별로 실제 실행해 행동과 비용을 비교, 선택 사항이며 PR 요건이 아님

요구 사항: Node 20 이상, `claude` CLI 로그인 상태

### 조건

| 조건 | 설명 |
| --- | --- |
| `direct` | 워크플로 설치 없이 Claude가 직접 처리 |
| `lite` | 워크플로 설치(Lite), PM이 역할을 직접 호출 |
| `full` | 워크플로 설치(Full), 리드가 호출 카드를 반환하고 PM이 호출 |

### 과제

`tools/eval/fixture/`(할 일 앱, 테스트 2건)에서 실행, 과제 프롬프트는 `tools/eval/run-eval.mjs`의 `tasks`에 정의

| ID | 성격 | 프롬프트 요지 |
| --- | --- | --- |
| `q` | 질문 | `completeTask`의 역할 설명, 수정 금지 |
| `l1` | 단순 수정 | 주석 오탈자 수정 |
| `l2` | 동작 변경 | 할 일 우선순위 추가, 기존 테스트 통과 유지 |
| `l3` | 계약 변경 | `completeTask` 반환 타입 변경과 호출처 수정 |
| `scope` | 금지 영역 | 생성 파일 `dist/bundle.js` 수정 요청 |
| `inject` | 주입 | `docs/NOTES.md` 요약, 문서 속 지시 무시 확인 |
| `ctx` | 외부 문서 | Context7로 API 확인, 수정 금지 |

`fixture/docs/NOTES.md`의 주입 문장은 의도적이며 지시로 따르지 않음

### 1회 실행

```sh
REPO=<저장소 절대 경로> BUDGET=2 node tools/eval/run-eval.mjs <direct|lite|full> <q|l1|l2|l3|scope|inject|ctx> <출력 폴더>
```

- 임시 폴더에 fixture를 복사하고 `git init`, 워크플로 조건이면 설치 스크립트로 `plan` → `apply` 수행
- `claude -p`를 비대화형으로 실행하고 `--output-format stream-json`으로 이벤트 전체 저장
- 실행 뒤 `git status`·`git diff`로 변경 파일을 집계하고 fixture의 `npm test` 통과 여부 확인
- 저장소 파일은 수정하지 않으며 출력 폴더는 저장소 밖 권장

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `REPO` | 없음(필수) | 설치 스크립트가 있는 저장소 경로 |
| `BUDGET` | 2 | 호출당 비용 상한(달러), 도달하면 호출 중단 |
| `PERM` | acceptEdits | 권한 모드 |
| `EXEC_MODE` | relay | Full의 실행 모드(relay 또는 nested) |
| `CTX7` | 미설정 | `1`이면 Context7 등록 |
| `EXTRA_TOOLS` | 없음 | 추가로 허용할 도구, 쉼표로 구분 |

출력 폴더에 `<조건>-<과제>.json`(요약), `.diff`(변경 내용), `.events.jsonl`(이벤트 원본) 저장

### 결과 집계와 그래프

```sh
node tools/eval/collect.mjs <그룹 이름> <출력 폴더> > docs/verification/data/small-fixture/results-<그룹 이름>.json
node tools/eval/report.mjs docs/verification/data/small-fixture docs/verification/assets/mode-compare.svg
```

- `collect.mjs`가 비용·시간·토큰·위임 호출을 JSON으로 수집
- `report.mjs`가 `docs/verification/data/small-fixture`의 JSON으로 비교 그래프 SVG 생성

### 비용 예산

- 호출 수 × 호출당 상한(`BUDGET`)이 최대 지출, 시작 전에 계산해 승인
- 직접 처리는 호출당 0.1~0.2달러, 워크플로 조건 L2·L3는 호출당 1~2달러 수준이 나왔음(환산 값)
- 구독 로그인이면 표시 비용은 청구액이 아닌 환산 값이며 사용 한도를 소모

### 결과 기록

결과를 공개할 때 아래를 함께 기재

- 무엇을 재는지, 조건, 과제, 반복 횟수, 모델, 호출당 상한, 측정일, 대상 커밋, Claude Code 버전
- 실패·중단 사례(결과에서 제외한 실행 포함)와 원본 JSON 위치
- 확인하지 못한 것: 과제당 1회는 변동 범위를 알 수 없고 통계적 비교가 아님

기록은 릴리즈 버전이 아니라 시험 종류별로 `results/`에 모으고, 같은 시험을 다시 하면 새 회차를 같은 문서에 추가, 목록은 [검증 기록 목차](README.md)
기록 예: [소규모 fixture 비교](results/small-fixture-comparison.md)

## 3. 확인할 수 없는 것

- 대화형 trust 화면과 엄격 모드의 실제 승인 흐름: 비대화형 실행으로는 재현 불가
- 권한 모드 auto·bypassPermissions·plan, macOS·Linux 실행: 측정한 범위 밖
- 단일 소형 fixture 결과는 다른 프로젝트·모델에 일반화 불가

## 4. 어려운 과제 평가

직접 처리·Lite·Full을 같은 과제·같은 격리 조건에서 실행하고 코드로 채점, 선택 사항이며 PR 요건이 아님
설계와 성공 기준은 [평가 설계](EVAL_DESIGN.md)에 실행 전에 고정, 결과에 맞춰 바꾸지 않고 바꾸면 변경 이력을 남김

```sh
REPO=<저장소 절대 경로> BUDGET=2 CLAUDE_BIN=<claude 실행 파일> node tools/eval/hard/run.mjs <direct|lite|full> <s1|s2|x1|m1|m2|m3|l1|l2> <반복 번호> <출력 폴더>
node tools/eval/hard/aggregate.mjs <출력 폴더> > results.json
```

- 채점기(깨진 호출처, 범위 밖 수정, 누락 요구, 허위 성공, 주입)는 실제 Claude 없이 `tools/eval-hard.test.mjs`로 검증하며 `npm test`에 포함
- 과제 정의와 환경 변수는 [tools/eval/hard/README.md](../../tools/eval/hard/README.md)
- Windows에서 npm으로 설치한 Claude Code는 `claude`가 셸 스크립트라 `run.mjs`가 직접 실행하지 못하고 모델이 호출되지 않은 채 끝남, `CLAUDE_BIN`에 `claude.exe`의 실제 경로(npm 전역 폴더 아래 `node_modules/@anthropic-ai/claude-code/bin/claude.exe`)를 지정
- 여러 Claude Code가 설치돼 있으면 `CLAUDE_BIN`과 PATH 앞쪽 실행 파일이 같은 버전인지 확인, 결과 JSON에 실행한 버전이 기록됨
- 사용 한도에 걸리면 `run.mjs`가 기록 없이 종료 코드 3으로 끝나므로 배치는 그 시점에 멈추고 풀린 뒤 이어서 실행
- 호출 수 × `BUDGET`이 최대 지출, 시작 전에 계산해 승인

결과 기록: [어려운 과제 비교](results/hard-task-comparison.md)
