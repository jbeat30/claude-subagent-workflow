# 새 버전 받기와 갱신·제거

[README로 돌아가기](../../README.md)

## 새 버전 받기

플러그인을 이미 쓰고 있어도 새 버전은 자동으로 받아지지 않아요. 직접 만든 마켓플레이스는 자동 갱신이 기본으로 꺼져 있고, 플러그인을 갱신해도 프로젝트에 설치된 워크플로 파일은 그대로라서 두 단계가 필요해요.

1. 플러그인 갱신 (터미널)

```text
claude plugin marketplace update jbeat-plugins
claude plugin update subagent-workflow@jbeat-plugins
```

2. 새 세션을 시작하거나 `/reload-plugins` 실행
3. 프로젝트의 워크플로 파일 갱신: `/subagent-workflow:setup update`

- 갱신이 필요한지 확인: `/subagent-workflow:check` 실행, `team version` 항목이 `update`이면 프로젝트의 워크플로 파일이 플러그인보다 낮은 버전
- 세션 안에서 갱신: `/plugin` → Marketplaces 탭 → `jbeat-plugins` → Update marketplace (설치한 플러그인까지 함께 갱신)
- 자동 갱신 켜기(선택): `/plugin` → Marketplaces 탭 → `jbeat-plugins` → Enable auto-update. 켜도 플러그인만 갱신되며 3번(프로젝트 워크플로 파일 갱신)은 직접 실행

## 갱신과 제거

```text
/subagent-workflow:setup update
/subagent-workflow:setup remove
```

- **갱신**: 설치된 워크플로 파일을 새 버전으로 **전체 교체**해요. 바뀌는 내용을 계획으로 보여 드리고, 확인한 뒤에 적용해요. 설치 후 직접 수정한 파일은 자동으로 덮어쓰지 않고, 건너뛰거나 백업 후 교체하는 것 중에서 고르게 해요.
- **제거**: 미리보기를 보여 드리고 확인받은 뒤, 설치한 항목만 되돌려요. 직접 수정한 파일은 그대로 두고, 작업 기록(`.claude-team-docs`)과 백업은 삭제하지 않아요.
- v0.2.0부터 프롬프트와 기록 라벨이 영어로 바뀌어서, 이전 버전에서 진행 중이던 작업 기록은 새 버전이 읽지 못해요. 갱신하기 전에 마무리해 주세요.
- v0.2.x 이하에서 갱신하면 그 버전이 넣은 `agent=pm-agent` 설정을 해제해서 메인 세션이 PM으로 고정되지 않게 해요. 수정하지 않은 구 PM 에이전트 파일은 삭제해요. 직접 바꾼 설정과 파일은 그대로 둬요.
