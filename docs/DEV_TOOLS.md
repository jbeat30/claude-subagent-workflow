# 개발 도구 가이드

이 저장소를 개발하는 소유자 환경에서 쓰는 도구의 역할, 설치 범위, 시작 방법, 유지보수 정리
플러그인 사용자와 기여자에게는 필요하지 않으며 `npm test`와 기여 규칙은 `.github/CONTRIBUTING.md` 기준
확인된 사실은 검증 환경(2026-11-02, Windows, Claude Code 2.1.316, Git Bash, zsh)에서 직접 확인한 내용이고, 권장 운영은 별도로 표시

## 1. 목적과 역할

| 도구 | 종류 | 역할 |
| --- | --- | --- |
| jbeat-conventions v2.0.1 | Claude Code 플러그인(스킬 2종) | 프로젝트 코딩 컨벤션 적용 |
| Ponytail | Claude Code 플러그인(훅 포함) | 기존 구현 재사용과 단순한 구현 유도로 불필요한 작업 감소 |
| Graphify | 별도 CLI + 프로젝트 스킬, 훅 | 코드 지식 그래프로 관련 코드 경로를 좁혀 반복 탐색 감소 |
| Headroom | 별도 CLI(로컬 프록시) + MCP | Claude 요청 중 압축 가능한 입력의 크기 감소 |

- 세 도구를 모두 스킬로 부르지 않음, 스킬은 jbeat-conventions와 Graphify의 프로젝트 사본이고 Headroom은 프록시
- 절감률, 사용 시간 증가, 오류 감소는 보장하지 않음, 필요하면 아래 6절 방법으로 직접 측정

## 2. 적용 범위와 자동화

| 도구 | 검증한 버전, 출처 | 설치 범위 | 자동 적용 조건 | 자동으로 처리하지 않는 것 | 명시적 호출, 갱신 필요 |
| --- | --- | --- | --- | --- | --- |
| jbeat-conventions | v2.0.1(태그 커밋 0908dc0), <https://github.com/jbeat30/jbeat-conventions> | 이 프로젝트(project 범위) | 설치 후 새 세션에서 `CLAUDE.local.md`의 연결 구역이 로드될 때 관련 작업에서 스킬 사용 안내 | 설치만으로 모든 응답에 적용되지 않음, 규칙 준수 보장 없음 | `/jbeat-conventions:jbeat-apply`로 직접 호출 가능, 연결은 `/jbeat-conventions:jbeat-setup` |
| Ponytail | 플러그인 5.3.3, <https://github.com/DietrichGebert/ponytail> | 이 프로젝트(project 범위) | 세션 시작 훅이 모드를 주입, 확인된 모드는 full | 프로젝트 컨벤션을 대체하지 않음, 요구사항, 검증 생략 허가 아님 | `/ponytail lite\|full\|ultra\|off`로 모드 변경 |
| Graphify | CLI 0.9.100, <https://github.com/Graphify-Labs/graphify> | CLI는 사용자 전역, 훅, 스킬은 이 프로젝트의 `.claude/` | Bash, Grep, Read, Glob 호출 전에 훅이 그래프 사용 힌트를 추가 | 질의 실행과 그래프 갱신은 하지 않음(훅은 안내만 함) | `graphify update .`로 갱신, 질의는 요청 시 |
| Headroom | CLI 0.42.0, <https://github.com/headroomlabs-ai/headroom> | CLI는 사용자 전역, 프록시 경유는 wrapper로 시작한 세션만 | `headroom wrap claude`로 시작하면 `ANTHROPIC_BASE_URL`이 로컬 프록시로 설정 | 일반 `claude` 실행은 프록시를 거치지 않음, 모든 입력이 압축되는 것은 아님 | wrapper로 시작해야 함 |

## 3. jbeat-conventions v2.0.1

### 설치, 업데이트, 호출

```text
/plugin marketplace add jbeat30/jbeat-plugins
/plugin install jbeat-conventions@jbeat-plugins
/jbeat-conventions:jbeat-setup
```

- 업데이트: 셸에서 `claude plugin marketplace update jbeat-plugins` 후 `claude plugin update jbeat-conventions@jbeat-plugins`
- 이 프로젝트의 연결 구역은 `CLAUDE.local.md`(Git 제외)에 있음, 공유 지침인 `AGENTS.md`에는 넣지 않음(기여자는 설치하지 않아도 되므로)
- 연결 확인: `/jbeat-conventions:jbeat-setup status`, 제거: `/jbeat-conventions:jbeat-setup remove`
- 예시: `로그인 오류를 수정해줘. 관련 실패 경로도 확인해줘.`, 직접 호출은 `/jbeat-conventions:jbeat-apply 이 변경사항을 리뷰해줘.`
- 구 호출 `/jbeat-apply`는 쓰지 않음, 저장소 안내는 이번 변경으로 새 이름으로 수정

### Ponytail과의 우선순위

1. 프로젝트의 명시적 코딩 규칙
2. jbeat-conventions v2.0.1
3. Ponytail(보조 지침)

- 프로젝트 규칙과 jbeat-conventions가 충돌하면 jbeat 규칙대로 사용자에게 선택을 요청, 불명확하면 임의 결정 금지
- 같은 내용은 `AGENTS.md`의 "개발 도구 우선순위"에 한 번만 기록

### 원복

- 연결만 해제: `/jbeat-conventions:jbeat-setup remove` 또는 `CLAUDE.local.md` 삭제
- 플러그인 비활성화: `/plugin`에서 비활성화
- 구버전 복원이 필요하면 `~/.claude/backups/patch-0.6.1-20261102/user/installed_plugins.json` 참고

## 4. Claude Code 시작 방법

프로젝트 폴더에서 실행해야 `.claude/` 설정, 프로젝트 범위 플러그인, 그래프가 함께 적용됨

```sh
# 권한 확인 유지(기본 권장)
headroom wrap claude --code-memory none

# 권한 확인 생략(선택)
headroom wrap claude --code-memory none --dangerously-skip-permissions
```

- Windows의 zsh에서 소유자가 이 명령으로 대화형 세션을 실행해 정상 동작을 확인했고, 검증 중에도 두 명령이 `claude`로 인자를 전달하고 종료 코드 0으로 끝나는 것을 `--version` 전달로 확인
- Git Bash와 PowerShell에서도 같은 문법이지만 검증하지 않음
- `--code-memory none`: Headroom의 코드 메모리 MCP(기본값 Serena) 등록을 건너뜀, 압축 프록시 경유와는 별개
- `--dangerously-skip-permissions`: Claude Code의 권한 확인을 생략하는 선택 옵션, 세 도구 연동에 필수가 아니고 신뢰하는 저장소에서만 사용
- wrapper 세션에서는 `/remote-control`(`/rc`)이 비활성화됨(`headroom doctor` 경고), 필요하면 일반 `claude` 사용

## 5. 평소 작업과 그래프 갱신

일반 작업: `질문 정책 문서에서 중복 표현을 정리해줘.`
경로 탐색 요청: `graphify로 플러그인 읽기 허용 로직이 있는 파일부터 찾아줘.`
갱신 요청: `구조를 바꿨으니 graphify update로 그래프를 갱신해줘.`

- 직접 갱신: 저장소 루트에서 `graphify update .`, AST 기반 로컬 분석이라 모델 호출과 API 키가 필요 없음
- 직접 질의: `graphify query "<질문>" --budget 1000`, `graphify explain "<개념>"`, `graphify path "A" "B"`
- 갱신 시점은 파일, 함수, 모듈을 추가, 삭제, 이름 변경한 뒤, 문서만 바꾼 경우와 한 파일 안의 작은 수정은 불필요
- 자동 갱신 없음: 훅은 질의, 갱신을 실행하지 않고 안내만 하며 git 훅(`graphify hook install`)도 설치하지 않음
- 로컬 분석과 모델 호출 분석은 다름: 문서, 이미지 변경 반영(`/graphify --update`)과 커뮤니티 이름 지정(`graphify label`)은 모델 호출이 필요할 수 있음, 이번 구성은 API 키를 추가하지 않음
- 결과가 부족하면 `--budget`을 늘리거나 `--seed`로 시작 노드를 지정하고, 그래도 부족하면 `graphify update .` 후 해당 파일을 직접 읽음
- 그래프는 코드, 문서 구조 요약이라 정확한 동작은 원본 파일과 테스트로 확인

## 6. 상태 확인과 유지보수

| 확인 대상 | 방법 |
| --- | --- |
| 플러그인 로딩 | `claude plugin list`(jbeat-conventions 2.0.1과 ponytail이 enabled, `failed to load` 없음) |
| 스킬 호출 가능 여부 | 새 세션에서 `/jbeat-conventions:jbeat-setup status` |
| Headroom 프록시 | `headroom doctor`, wrapper 세션에서 `echo $ANTHROPIC_BASE_URL` |
| 요청 통과, 압축 통계 | `headroom savings`, `headroom dashboard` |
| Graphify | `graphify query "<질문>"`이 종료 코드 0으로 노드를 반환 |

- 구분: 설치 성공, 설정 연결, 실제 요청 성공, 압축 확인은 서로 다른 단계, 프록시가 떠 있다는 사실만으로 압축을 입증하지 않음
- 압축 통계는 프록시가 처리한 입력 기준이고 전체 작업, 구독 사용량 절감률이 아님, 캐시 절감 등 다른 요인이 섞여 있음
- `tool_search_deferred_orphan` 경고: Headroom 프록시 로그의 경고로, 지연 로딩 도구를 인식하지 못해 도구 스키마 처리를 건너뛴다는 뜻(Headroom 소스 확인), 요청 실패는 아니며 검증 세션에서도 요청은 정상 통과
- `command not found`: `~/.local/bin`이 PATH에 있는지 확인 후 터미널 재시작, 설치는 `uv tool list`로 확인
- 터미널, Claude 재시작 필요: 플러그인 설치, 업데이트 직후, `CLAUDE.local.md`나 `.claude/settings.json` 변경 후
- 일반 `claude`는 프록시를 거치지 않음, 플러그인, 훅, 지침은 동일하게 로드되고 Headroom 압축만 빠짐

### 공유 파일과 로컬 전용 파일

| 구분 | 파일 |
| --- | --- |
| 공유(커밋) | `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.graphifyignore`, 이 문서 |
| 로컬 전용(Git 제외) | `.claude/`(훅, 플러그인 활성화, Graphify 스킬 사본), `CLAUDE.local.md`, `graphify-out/` |

- `graphify-out/`은 `graphify update .`로 재생성 가능하고 로컬 절대 경로(`.graphify_root`)와 세션 캐시를 포함하며 갱신마다 `graph.json` 전체가 바뀌므로 커밋하지 않음
- `.claude/`는 `graphify` 미설치 환경에서 훅 오류를 낼 수 있어 기여자에게 공유하지 않음
- Graphify는 `.gitignore`와 `.git/info/exclude`를 함께 적용, `.graphifyignore`는 Git에 두고 비밀 파일, 빌드 산출물, 로컬 도구 설정을 분석에서 제외하며 `.gitignore`와 일부 겹치는 것은 의도된 중복(`--no-gitignore` 실행 대비)

### 새 개발 환경

1. Claude Code 설치, 프로젝트 클론
2. Headroom, Graphify는 각 공식 저장소 안내로 설치하고 `uv tool list`로 버전 확인(검증 환경은 uv tool 설치)
3. `/plugin marketplace add jbeat30/jbeat-plugins`, `/plugin install jbeat-conventions@jbeat-plugins --scope project`, `/plugin marketplace add DietrichGebert/ponytail`, `/plugin install ponytail@ponytail`
4. `graphify claude install`로 훅 등록 후 `graphify update .`
5. `/jbeat-conventions:jbeat-setup`으로 연결(저장 위치는 `CLAUDE.local.md` 선택)
6. `headroom wrap claude --code-memory none`으로 시작

### 업데이트, 비활성화

- jbeat-conventions: 3절, Ponytail: `/ponytail off` 또는 `/plugin`에서 비활성화
- Graphify 훅 제거: `graphify claude uninstall`(CLAUDE.md의 graphify 구역과 훅 제거), Headroom: 일반 `claude`로 시작
- 설정 변경 전 백업은 저장소 밖(`~/.claude/backups/`)에 보관, 활성 스킬 디렉터리 안에 두지 않음

### 확인된 제약

- 설치 직후 세션에서는 새 플러그인 스킬 목록이 갱신되지 않을 수 있어 재시작 후 확인 필요
- Headroom wrapper 세션은 `/remote-control` 사용 불가
- Graphify의 코드 분석만 로컬이고 문서, 이미지 의미 추출은 모델 호출이 필요할 수 있음
- Ponytail 모드 문구는 응답 간결성을 높이는 지침이며 생략해도 되는 검증은 없음
