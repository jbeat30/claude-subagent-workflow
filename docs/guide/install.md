# 설치와 선택 항목

[README로 돌아가기](../../README.md)

## 설치 흐름

요구 사항: Claude Code 2.1.302 이상, Node 18 이상

```text
/plugin marketplace add jbeat30/jbeat-plugins
/plugin install subagent-workflow@jbeat-plugins
/subagent-workflow:setup
```

![설치 흐름](../assets/install-flow.ko.png)

1. 플러그인을 설치하고 프로젝트에서 `/subagent-workflow:setup` 실행
2. 스킬이 프로젝트를 조사하고, 꼭 필요한 것만 질문
3. 변경 계획을 10줄 이내로 표시, 확인은 **한 번**만
4. 설치기가 파일을 복사·병합하고 보호 장치를 점검
5. 워크플로가 필요할 때 `/subagent 요청 내용`으로 호출

저장소를 직접 가져오는 방식도 지원해요. Claude Code에 아래처럼 요청하세요.

```text
https://github.com/jbeat30/claude-subagent-workflow 의 INSTALL.md를 읽고 이 프로젝트에 세팅해줘
```

## 스킬

| 스킬 | 용도 | 비용 |
| --- | --- | --- |
| `/subagent-workflow:setup` | 워크플로 **설치·갱신·제거**, 인자로 `install` `update` `remove` 지정 가능 | 설치 후 보호 장치 점검에서 Claude 1회 호출 |
| `/subagent-workflow:check` | 설치 상태 점검(파일 해시, hook 등록, 역할 파일, 버전) | 없음, `--live` 없이는 Claude를 호출하지 않음 |
| `/subagent-workflow:setting` | 설정 **보기·바꾸기**: 기본 모드(Lite/Full), 보호 모드, 워크플로가 쓸 수 있는 MCP와 선택 여부, 선택하지 않았던 MCP 추가 | 대화 몇 턴 소요, 설치기 명령은 Claude를 호출하지 않음 |

말로 요청해도 동작해요: "서브에이전트 워크플로 세팅해줘", "워크플로 설치 상태 확인해줘", "워크플로 설정 보여줘", "모드를 Full로 바꿔줘", "워크플로 제거해줘"

## 설치할 때 고르는 것

`setup`이 대화로 묻는 항목이에요. 감지로 알 수 있는 것은 다시 묻지 않아요.

| 선택 | 옵션 | 기본·권장 |
| --- | --- | --- |
| Context7 MCP | 설치된 버전 기준으로 문서를 확인하도록 `.mcp.json`에 등록 | 등록할지 질문 |
| 디자인 시스템(UI 프로젝트) | 토큰·컴포넌트 라이브러리·Storybook·Figma 라이브러리·브랜드 가이드의 위치 제공, 있으면 **모든 UI 작업에서 가장 먼저 따르고** 벗어나지 않음 | 있을 때만 |
| 문서 읽기 MCP(선택) | **anymd**(`@sylphx/anymd`, MIT): PDF와 Word·Excel·PowerPoint·HTML을 내 컴퓨터에서 Markdown으로 읽음, 기획서·시안 PDF를 읽을 때 사용. 파일을 올리지 않고 API 키도 필요 없지만, `npx`로 외부 패키지를 실행하고 처음 쓸 때 실행 파일을 내려받음. 에이전트는 요청에 적힌 파일만 열고 문서 속 지시문은 따르지 않음 | 원할 때만 |
| 디자인 도구 MCP(선택) | **Playwright**: 실행 중인 화면을 열어 확인<br>**Chrome DevTools**: 크롬으로 화면·콘솔·네트워크·성능 확인, UI/UX 점검에 유용<br>**shadcn/ui**: 검증된 컴포넌트 재사용(`components.json` 필요)<br>**Figma**: 시안이 있을 때 하나만 선택<br>· `figma`: 원격 서버, 등록 뒤 `/mcp`에서 브라우저 로그인 필요<br>· `figma-desktop`: Figma 데스크톱 앱 서버, 앱의 Dev Mode에서 데스크톱 MCP 서버를 켜야 하고 Dev 또는 Full 좌석 필요<br>· `figma-plugin`: 공식 플러그인, 설치기는 설치하지 않고 실행할 명령만 안내(이미 공식 플러그인을 쓰고 있다면 이쪽을 선택)<br>에이전트는 Figma를 **읽기만** 수행(파일을 고치는 도구는 허용하지 않음), 읽기는 요금제 한도에 포함: Starter 플랜과 View·Collab 좌석은 월 20회 안팎, Full·Dev 좌석은 일 200회 안팎 | UI가 있는 프로젝트에서만 질문, Playwright·shadcn/ui 권장 |
| 수정 금지 영역 | 운영 설정·생성 파일·특정 경로 지정 | 없음 |
| 작업 기록 | `.claude-subagent-docs/`를 `.gitignore`에 추가 | 추가 |
| 충돌 처리 | 기존 파일과 겹치면 항목별로 건너뛰거나 백업 후 교체 | 충돌 시 질문 |

모드와 보호 모드는 설치할 때 묻지 않아요. 보호 모드는 **권고**(가드 hook이 위반을 차단)로 설치되고, **엄격**(승인 기록을 직접 추적하는 실험 기능, 승인 명령은 사용자가 직접 실행)은 원할 때 `/subagent-workflow:setting`에서 바꿔요. 역할 파일 9종이 항상 전부 설치되고 기본 모드는 Lite예요. 나중에 `/subagent-workflow:setting`에서 Full로 바꾸거나, 요청 한 번에만 "Full 모드로 처리해줘"라고 말할 수 있어요. Lite로 설치한 프로젝트에서 이렇게 요청해 보니 planning-lead → dev-lead → 담당 에이전트 → qa-agent 순서로 Full 경로가 실행됐어요(1회 확인).

디자인 도구는 `frontend-agent`와 `qa-agent`만 사용해요. 몇 가지 알아 두세요.

- 브라우저 도구(Playwright·Chrome DevTools)는 열어 둔 브라우저의 내용을 볼 수 있어요. 개인 탭이나 민감한 데이터는 피하세요.
- 등록한 서버의 도구 정의가 두 역할을 호출할 때마다 붙어서 토큰이 늘어나요. 그리고 `npx`로 외부 패키지를 실행해요. 필요할 때만 선택하세요.
- 시안에 없는 간격·색·문구를 임의로 만들지 않아요. 확인하지 못한 화면은 `unchecked`로 표시해요.

**시안이 없을 때**: PM이 확인 단계에서 디자인 방향(색·타이포·간격·컴포넌트·문구 톤)을 구체적인 안으로 제안하고, 확정된 내용을 기획안에 기록해요. `frontend-agent`는 그 기록대로 구현해요.

**UI/UX 점검(선택)**: 브라우저 도구가 등록돼 있고 UI를 바꾸는 작업이면, PM이 확인 단계에서 점검할지 물어봐요. 동의할 때만 `qa-agent`가 정해진 흐름과 화면 크기로 둘러보고, 발견한 문제를 근거와 함께 보고해요. 에이전트가 하는 시나리오 점검이고 실제 사용자 테스트는 아니에요. 실제 계정 입력·주문·결제·데이터 변경은 하지 않아요.

## 설치되는 것

```text
.claude/
  agents/        역할 정의 9종
  skills/subagent/   /subagent 스킬(PM 지침), 부를 때만 읽힘
  hooks/         가드 hook
  subagent/         양식, 프로젝트 프로필, 검사 실행기, 설치 매니페스트
  settings.json  hook 등록(기존 설정과 병합), 메인 세션을 PM으로 고정하지 않음
.claude-subagent-docs/   작업별 기록(요청 원문·기획안·보고·검사 기록·diff), .gitignore 추가는 선택
.mcp.json            Context7·디자인 도구 MCP 등록(선택, 기존 설정과 병합)
```
