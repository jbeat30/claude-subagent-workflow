# 새 버전 받기와 갱신·제거

[README로 돌아가기](../../README.md)

## 새 버전 받기

역할, PM 지침, 가드는 플러그인에 들어 있어서 플러그인만 갱신하면 모든 프로젝트에 반영돼요. 직접 만든 마켓플레이스는 자동 갱신이 기본으로 꺼져 있어요.

```text
claude plugin marketplace update jbeat-plugins
claude plugin update subagent-workflow@jbeat-plugins
```

갱신한 뒤 새 세션을 시작하거나 `/reload-plugins`를 실행하세요.

- 세션 안에서 갱신: `/plugin` → Marketplaces 탭 → `jbeat-plugins` → Update marketplace
- 자동 갱신 켜기(선택): `/plugin` → Marketplaces 탭 → `jbeat-plugins` → Enable auto-update

## v0.5.x 이하에서 옮기기

v0.5.x까지는 역할, PM 지침, 가드를 프로젝트의 `.claude/`에 복사했어요. v0.6.0부터는 플러그인이 직접 제공해요. 플러그인을 갱신한 뒤 프로젝트마다 한 번 실행하세요.

```text
/subagent-workflow:setup update
```

- 예전에 복사한 파일(`.claude/agents/`의 기본 역할 9종, `.claude/skills/subagent/`, `.claude/hooks/subagent-guard.mjs`, `.claude/subagent/bin/` 등)과 `.claude/settings.json`의 옛 가드 hook을 정리해요. **직접 고친 파일은 지우지 않고** 목록으로 알려 드려요.
- 바뀌는 내용을 계획으로 보여 드리고, 확인한 뒤에 적용해요.
- 작업 명령은 `/subagent`에서 `/subagent-workflow:run`으로 바뀌었어요.
- 정리가 필요한지는 `/subagent-workflow:check`로 확인할 수 있어요. `workflow version`이나 `settings hooks` 항목이 `update`이면 정리할 파일이 남아 있는 거예요.
- 이전 버전에서 진행 중이던 작업 기록은 새 버전이 읽지 못할 수 있어요. 갱신하기 전에 마무리해 주세요.

## 제거

```text
/subagent-workflow:setup remove
```

- 미리보기를 보여 드리고 확인받은 뒤, setup이 만든 항목(프로젝트 설정 파일, MCP 등록, `.gitignore` 블록)만 되돌려요. 직접 수정한 파일은 그대로 둬요.
- 작업 기록(`.claude-subagent-docs`)과 백업은 삭제하지 않아요.
- 워크플로를 완전히 끄려면 플러그인도 제거하세요: `/plugin` → Installed 탭에서 제거
