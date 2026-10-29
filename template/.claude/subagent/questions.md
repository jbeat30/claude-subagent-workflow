# Question policy

Applies to every question the PM puts to the user, whether it comes from the PM itself, an agent's `needs-input`, a mandatory approval trigger, or the UI verification rules. The goal is to ask when asking is needed and to ask once, in words the user can answer.

## Look before asking

Do not ask what the request source, the repository, the profile, the rule files, or the installed library docs already answer. Read or search first and ask only what is still open. Never fill a gap by guessing.

## When to ask

- The answer could change what is built, which interpretation of the request applies, or whether a risky action proceeds (the mandatory approval triggers).
- The answer is something only the user has: a preference, a business or policy decision, an external fact, or a tool or environment.

## When not to ask

- The choice is a style or detail the project's own rules or the profile conventions already settle.
- Every option gives the same result for this request. Pick the one that matches the existing code and record it in plan section 4 as an assumption.
- The answer would only add verification work and could not change finished work. Hold it for the one message at the end (`.claude/subagent/ui-verification.md`).

## One message per moment

Put every open question of the same moment in one message, not one at a time. At G2 fold these into the confirmation message: the planner's user question list, agents' `needs-input` questions, UI verification ambiguities, and approval items. Merge duplicates: the same question from two agents is one question. Mid-run, ask at once only when the answer could change finished work; otherwise hold the question for the next gate or the final report.

## Split decisions from defaults

Show the user two separate lists in the message: the decisions only the user can make, and the defaults you will use unless told otherwise. A decision is something where the options lead to clearly different results and no existing code or rule picks one. A detail with a safe default belongs in the defaults list, not in the questions: input limits and error handling, naming, internal structure, file placement, and anything the existing code already does one way. Ask at most three decisions per message; if more remain, ask the ones that block the most work and put the rest in the defaults list with your recommendation. Say once that "go with your recommendations" is a valid answer.

## Make each question answerable

- Use plain words. Never write grade names (Q, L1, L2, L3), gate names (G0 to G5), role names (`planner-agent`, `qa-agent`, and so on), `needs-input`, or `runId` in a message to the user. They are for your own records. Say what they mean instead: for L3 write "this change touches several areas and needs your confirmation first", for L2 write nothing about the grade.
- Say what is unknown in one line and quote the source text it comes from.
- Give two or three options and say what each one changes: what gets built, extra work, risk.
- Mark a recommended option when you have a reason, and give the reason in one line.
- Put the question that blocks the most work first.
- Put notices that are not questions (for example a document that contained instructions you ignored) after the questions, in one line.

## Do not ask twice

Record each answer in plan section 4 as `User decision: <question>, answer: <answer>`. Before asking, check section 4 and the conversation so far. When a plan change voids the confirmation, ask again only about what changed.

## When the user cannot or will not answer

If the user cannot answer or tells you to decide, use the safest option: the smallest change that keeps existing behavior and can be undone. Record it as an assumption with evidence `unchecked` and list it in the final report so the user can overrule it. Never treat silence or "decide for me" as approval for a mandatory approval trigger. Leave that item unexecuted and report it.
