# 설치 후 설정 전환 점검: 모드와 보호 모드

무엇을 재는가: 설치 뒤 `/subagent-workflow:setting`과 설치기 `config` 명령으로 기본 모드, MCP, 보호 모드(권고, 엄격)를 바꿀 수 있는지, 바꾼 뒤 설치 검증이 유지되는지
모두 조건별 1회씩의 동작 점검이며 효용 평가가 아님
측정 환경은 비대화형 실행(`claude -p`), 한 모델(sonnet), 작은 합성 fixture, 비용은 CLI가 보고한 환산 값(`total_cost_usd`)이며 구독 로그인이면 청구액이 아닌 사용 한도 소모
기록일 2026-10-22

## 점검 1: 설치 때 모드를 묻지 않는 설치와 설치 후 모드 전환

변경 내용: 설치 때 모드를 묻지 않고(항상 전체 역할 설치, 기본 Lite, 가드 relay 보호 상시), 설치 뒤 `/subagent-workflow:setting`과 `config` 명령으로 기본 모드 전환과 MCP 추가

| 점검 | 기대 | 결과 |
| --- | --- | --- |
| 설치 때 모드를 생략 | 기본 Lite, 실행 모드 relay로 기록 | 프로필에 `Execution profile: lite`, `Execution mode: relay` |
| Lite로 설치한 프로젝트에서 `/subagent 이번 요청은 Full 모드로 처리해줘 …` | Full 경로 실행 | planning-lead, dev-lead, backend, test, qa 순서로 호출, 프로필의 기본값(lite)은 그대로 두고 불일치를 보고, 0.80달러 |
| `/subagent-workflow:setting` | 현재 설정과 MCP 선택 현황 표시 | 기본 모드, 보호 모드, MCP 5종의 용도, 사용 역할, 선택 여부, 주의 사항을 표로 표시(0.05달러) |
| `/subagent-workflow:setting`으로 모드 전환과 MCP 추가 | 미리보기 후 적용, 설치 검증 유지 | `config` 미리보기 후 `--yes` 적용, 프로필 `full`, Figma 추가(`.mcp.json`, 프로필, 매니페스트 갱신), `verify` ok(0.06달러) |

### 점검 중 발견해 고친 문제

- Full 경로의 마지막 요구 보존 검사(`trace`)가 실패했음, planning-lead 호출 카드의 허용 파일에 계획서(`plan.md`)가 적혀 있는데 검사가 이를 "변경 계획 6장에 없는 소스 파일"로 판정했기 때문
- 실행 기록 폴더(`.claude-subagent-docs/runs/`) 안의 파일은 소스 파일 비교에서 제외하도록 고치고, 계획에 없는 소스 파일은 계속 탐지하는 테스트를 추가함
- 고친 뒤 Full 경로를 다시 실행해 `trace` 통과를 확인하지는 못함(단위 테스트로만 확인)

### 점검 1 한계

- 조건별 1회, 비대화형 실행, 스킬이 사용자에게 묻는 AskUserQuestion 화면은 거치지 않았고 요청문에 승인을 미리 적어 미리보기 후 바로 적용하게 했음
- Lite로 설치한 프로젝트에서 Full을 요청한 실행은 따랐다는 1회 확인일 뿐 항상 따른다는 보장이 아님
- 가드의 relay 보호는 Lite 설치에서도 켜지게 했으나 실제로 막는 장면은 따로 관찰하지 않음
- 마켓플레이스 캐시 경로에서 새 스킬과 `config` 명령이 로드되는지는 릴리즈 뒤에 확인해야 함

## 점검 2: 보호 모드 전환(권고, 엄격)

변경 내용: `/subagent-workflow:setting`과 `config --set-protection`으로 보호 모드 전환, 엄격으로 바꿀 때 경고 표시
총 환산 비용 약 0.15달러

| 점검 | 기대 | 결과 |
| --- | --- | --- |
| 권고 상태에서 `/subagent-workflow:setting`으로 엄격 전환 | 미리보기와 경고를 보여 준 뒤 적용 | `config --set-protection strict` 미리보기 후 `--yes` 적용, 프로필 `Protection mode: strict`, 경고 4항목(즉시 적용, 일반 수정 차단, `grant`와 `approve`는 사용자가 직접, 실험적이며 보안 경계 아님)을 최종 응답에 그대로 전달, `verify` 실패 없음(0.07달러) |
| 엄격 상태에서 메인 세션이 `src/note.txt` 작성 | 승인 기록이 없으므로 차단 | Write가 가드 hook에서 거부되어 파일이 만들어지지 않았고, 에이전트는 우회하지 않고 이유를 보고(0.03달러) |
| 엄격에서 `/subagent-workflow:setting`으로 권고 복귀 | 경고 없이 적용 | 미리보기 `warnings`가 비어 있었고 적용 뒤 프로필 `advisory`(0.05달러) |
| 권고 복귀 뒤 같은 파일 작성 | 차단 해제 | Write 성공, 파일 생성(0.01달러) |
| 마지막 `verify` | ok | ok |

### 점검 중 관찰한 점

승인 기록이 없는 엄격 상태의 차단 메시지가 `subagent-guard: guard error: ENOENT ... active-registration.json`이었음
차단 자체는 되었지만 "승인 등록이 필요함"이라는 안내가 아니라 파일 없음 오류로 표시됨, 이후 메시지를 개선했고 개선은 단위 테스트로만 확인했음

### 점검 2 한계

- 1회, 비대화형 실행, AskUserQuestion 화면은 거치지 않았고 요청문에 승인을 미리 적었음
- 엄격 모드의 승인 흐름(`review-grant`, `grant`, 등록, 수정 허용)은 거치지 않았음, 차단과 해제만 확인했고 대화형 승인 흐름은 미확인
- 엄격 모드는 메인 세션의 모든 수정에 적용되어 워크플로를 부르지 않은 평소 대화에도 영향을 줌
- 엄격 모드는 보안 경계가 아님
