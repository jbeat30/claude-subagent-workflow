# Node 없이 동작 가능성 점검

무엇을 재는가: 지금은 가드, 검사 실행기, 설치기가 모두 Node가 있어야 도는데, Node가 없는 환경(예: Spring 백엔드 개발자)에서도 같은 일을 하는 훅이 Claude Code에서 실제로 동작하는지, 그리고 어떤 방식이 현실적인지
측정일 2026-10-29, Claude Code 2.1.312(npm판의 네이티브 바이너리), Windows 11, 모델 sonnet, 비대화형 실행(`claude -p`), 호출당 비용 0.03달러 안팎
이 점검은 방식을 고르기 위한 것이며 제품 기능이 아님. 프로토타입은 "src 폴더 쓰기를 막는 훅" 하나뿐이고 실제 가드의 판정 로직을 옮긴 것이 아님
프로토타입 원본: `data/node-free-spike/`

## 현재 Node가 맡는 일

| 파일 | 줄 수 | 하는 일 | 1.0 약속 범위 |
| --- | --- | --- | --- |
| `template/.claude/hooks/subagent-guard.mjs` | 333 | 훅 입력 JSON 해석, 경로 정규화, 보호 경로 차단, 실행 상태에 따른 PM 수정 차단, 주석 판정(수정할 줄을 읽음), 역할별 쓰기 범위 | 핵심 |
| `subagent-run.mjs`, `subagent-state.mjs` | 51, 35 | 실행 상태 파일 시작, 등급 기록, 닫기 | 핵심 |
| `subagent-check.mjs` | 371 | 검사 명령 실행과 기록(`run`), 변경 비교(`diff`), 검증(`verify`), 요구 보존 확인(`trace`) | `run`, `diff`, `verify`는 핵심, `trace`는 실험 기능 |
| `subagent-policy.mjs`, `subagent-approval.mjs` | 128, 53 | 엄격 모드의 승인 등록과 해시 검증 | 실험 기능(1.0 약속 범위 밖) |
| `scripts/install.mjs` | 988 | 설치 조사, 계획, 적용, 검증, 제거, 설정 변경, 설정 파일 병합, 해시와 매니페스트 | 핵심 |

Node가 쓰는 기능은 JSON 읽고 쓰기, 파일 읽고 쓰기, 경로 처리, SHA-256 해시, 정규식, 자식 프로세스 실행이며 모두 어떤 언어에나 있는 기능임

## 확인한 사실

공식 문서에서 확인한 것

1. Claude Code 본체는 Node 없이 동작함(네이티브 설치는 자체 완결 바이너리, npm판도 같은 네이티브 바이너리를 쓰며 Node를 호출하지 않음)
2. 훅은 `command`, `http`, `mcp_tool`, `prompt`, `agent` 다섯 종류이고, `command` 훅에는 `shell`(`bash` 또는 `powershell`)과 실행 파일을 직접 지정하는 `args` 형식이 있음
3. Windows에서 Git for Windows(Git Bash)가 없으면 훅의 기본 셸이 PowerShell이 됨
4. 스킬의 `!` 명령에도 `shell` 필드가 있음, `shell: bash`인데 Git Bash가 없으면 스킬 호출이 실패함
5. 훅의 `if` 필터는 권한 규칙 문법이며 문서가 "최선 노력의 필터"라고 적어 하드 차단은 권한 시스템을 쓰라고 안내함

## 실제 Claude로 한 시험

PATH에서 Node를 뺀 상태(`node` 명령 없음 확인)로 실제 Claude를 실행하고, "src/a.txt에 hello를 써줘"를 시킴. 훅은 `src/` 아래 쓰기를 거부(종료 코드 2)

| 방식 | 훅 구현 | 결과 |
| --- | --- | --- |
| bash 훅 | bash 스크립트 + perl 표준 모듈(`JSON::PP`)로 JSON 해석 | Node 없이 훅 실행 확인(로그에 `node=none`), 쓰기 차단, 파일 생성 안 됨, 이유를 사용자에게 보고 |
| PowerShell 훅 | Windows PowerShell 5.1 스크립트(`ConvertFrom-Json`) | Node 없이 훅 실행 확인(로그에 PowerShell 5.1.26100, `node=False`), 쓰기 차단, 파일 생성 안 됨, 이유를 사용자에게 보고 |

두 방식 모두 훅 입력의 파일 경로가 Windows 역슬래시 형식(`C:\Users\...\src\a.txt`)으로 들어왔음

## 시험 중 발견한 함정 (실제 이식 때 반드시 처리)

1. **Windows 경로**: 훅 입력의 경로가 역슬래시로 오므로 두 방식 모두 먼저 슬래시로 바꿔야 함. 처리하지 않으면 경로 패턴이 맞지 않아 훅이 통과시킴. 첫 시도에서 bash 훅이 이 때문에 차단하지 못했음
2. **PowerShell 5.1의 인코딩**: BOM 없는 UTF-8 스크립트는 ANSI로 읽혀 한글 문자열이 깨지고 구문 오류가 남. 첫 시도에서 이 오류가 `onFailure: block` 때문에 "차단된 것처럼" 보였으나 실제로는 훅 실패였음(거짓 양성). 스크립트 첫 줄에 BOM이 필요함
3. **훅 실패와 의도한 차단의 구분**: `onFailure: block`이면 훅이 깨져도 막혀서 정상 차단과 구별되지 않음. 시험 때 훅 로그로 판정 로직까지 실행됐는지 확인해야 함
4. **perl 의존**: bash 방식은 JSON 해석에 perl이 필요함. 이 PC에는 `jq`가 없었고 `python3`는 버전을 출력하지 않아 쓸 수 없었음, perl(`JSON::PP` 포함)은 Git for Windows에 들어 있어 이 PC에서 동작했음. macOS와 Linux에 perl이 기본으로 있는지, 최소 Alpine 이미지에는 없는지는 이 시험에서 확인하지 않았고 일반적으로 알려진 내용임

## 훅 한 번당 지연 시간 (같은 입력 8회 평균)

| 방식 | 지연 |
| --- | --- |
| 지금의 Node 가드(실제 가드 전체) | 120ms |
| bash + perl 프로토타입(판정 로직 한 줄뿐) | 158ms |
| Windows PowerShell 5.1 프로토타입 | 477ms |
| PowerShell 7 프로토타입 | 766ms |

프로토타입은 판정 로직이 거의 없어서 실제 가드를 옮기면 더 늘 수 있음. 쓰기와 에이전트 호출마다 한 번씩 돌므로 PowerShell 방식은 체감될 수 있는 수준

## 확인하지 못한 것

- **단일 실행 파일(Go 또는 Rust) 방식**: 이 PC에 Go와 Rust가 없어 만들어 보지 못했음. 크기, 빌드, 배포 구성은 추정
- **macOS와 Linux 실제 실행**: 이 시험은 Windows(Git Bash와 PowerShell 5.1)에서만 했음
- **Git for Windows가 없는 Windows**: PowerShell 훅은 시험했지만, 이 PC에는 Git Bash가 있어 "Git 없는 환경"을 재현하지는 못했음
- **실제 가드 전체 이식**: 주석 판정, 실행 상태, 보호 경로, 해시 같은 실제 로직을 옮겨 보지 않았음
- **설치기 이식**: 988줄 설치기의 설정 파일 병합과 해시는 시험하지 않았음
- **스킬의 `!` 명령을 PowerShell로 돌리는 경우**: 시험하지 않았음
- **횟수**: 방식당 1회로 통계적 증거가 아님
