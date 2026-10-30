# Question policy

Applies to every question the PM puts to the user, whether it comes from the PM itself, an agent's `needs-input`, a mandatory approval trigger, or the UI verification rules. The goal is to ask when asking is needed and to ask once, in words the user can answer.

## Look before asking

Do not ask what the request source, the repository, the profile, the rule files, or the installed library docs already answer. Read or search first and ask only what is still open. Never fill a gap by guessing.

## When to ask

- The answer could change what is built, which interpretation of the request applies, or whether a risky action proceeds (the mandatory approval triggers).
- The answer is something only the user has: a preference, a business or policy decision, an external fact, or a tool or environment.
- The request leaves open what to build (which kind, which value, where it applies) and nothing in the repository or the rules settles it, for example "add a discount" with no kind, rate, or scope. Ask before you touch any file. Choosing a design for the user and building it is what this policy exists to prevent, even when the grade is L2 and every choice looks reasonable.

## When not to ask

- The choice is a style or detail the project's own rules or the profile conventions already settle.
- Every option gives the same result for this request. Pick the one that matches the existing code and record it in plan section 4 as an assumption.
- The answer would only add verification work and could not change finished work. Hold it for the one message at the end (`.claude/subagent/ui-verification.md`).

## One message per moment

Put every open question of the same moment in one message, not one at a time. At G2 fold these into the confirmation message: the planner's user question list, agents' `needs-input` questions, UI verification ambiguities, and approval items. Merge duplicates: the same question from two agents is one question. Mid-run, ask at once only when the answer could change finished work; otherwise hold the question for the next gate or the final report.

## Foresee and bundle

Before you write the message, trace every option through the existing callers and tests, and read what they expect today. If an option would change what an existing test or caller expects (for example the total an existing test asserts), that is a decision for this message, with the consequence stated and a recommendation. Then nothing foreseeable is left to ask after the user answers.
Always put the option that delivers the purpose in the real flow among the options, even when it needs something only the user can allow, such as changing the expected value of an existing test or editing callers. A project rule or an existing test that seems to forbid it does not remove the option: say in one line what must be allowed (for example, "the existing test expects the old total; it would be updated to the new required value, nothing weakened or deleted") and ask. Recommend the option that delivers the purpose when it can be undone. Recommend a smaller option only if you write in one line what it leaves unconnected, so the user knows nothing will use the new behavior yet.
When the open points depend on each other (what kind, what value, where it applies, what it does to existing tests), do not ask them as separate small questions. Ask one decision whose options are complete designs the user can pick whole, and mark the recommended design.

## Split decisions from defaults

Show the user two separate lists in the message: the decisions only the user can make, and the defaults you will use unless told otherwise. A decision is something where the options lead to clearly different results and no existing code or rule picks one. A detail with a safe default belongs in the defaults list, not in the questions: input limits and error handling, naming, internal structure, file placement, and anything the existing code already does one way. When the request already names what to build and gives the values (which options, which numbers, which return shape), it is a clear request: ask no decisions at all. Edge cases the request left open, such as whether an end date includes the whole last day, what happens when a deduction exceeds the total, empty or out-of-range input, error shape, and rounding, are defaults. Choose the safe one, list it in the final report as something you decided, and build. A question must offer real options; if you only want the user to confirm how you read the request, write it in the defaults list as "I read this as ..." and do not put it among the decisions. Ask at most three decisions per message; if more remain, ask the ones that block the most work and put the rest in the defaults list with your recommendation. Say once that "go with your recommendations" is a valid answer, and use the same words every time so the user always sees the same phrase: in English, `you can answer "go with your recommendations"`; in Korean, copy exactly the sentence printed after `Korean answer hint` in the output of the grade command, and only if you cannot see that line, output exactly the Hangul text that this escape string decodes to: `\uCD94\uCC9C\uB300\uB85C \uC9C4\uD589\uD574\uC918\uB77C\uACE0\uB9CC \uB2F5\uD558\uC154\uB3C4 \uB429\uB2C8\uB2E4` (each `\uXXXX` is one character; decode it and write only the decoded Hangul, never the escape codes, a romanization, a translation, or a note about the phrase). Use it with no quotation marks added and no extra words inside it. Do not paraphrase or shorten it ("the recommended option", "the suggested approach", "just say go ahead", or similar). The same phrase is required in an approval-only confirmation that has no decisions.

After the user has answered, or said to go with your recommendations, the final report is a report, never a question. Do not ask the user to pick or to tell you which is right ("let me know which one you want", "this must be decided first"), and do not use a "decision needed" heading. State what you decided as a plain statement, and add in one clause what changing it would involve ("if you want X instead, say so"). If something could only have been decided by the user, it was your job to ask it before building.

## Make each question answerable

- Use plain words. Never write grade names (Q, L1, L2, L3), gate names (G0 to G5), role names (`planner-agent`, `qa-agent`, and so on), `needs-input`, or `runId` in a message to the user. They are for your own records. Say what they mean instead: for L3 write "this change touches several areas and needs your confirmation first", for L2 write nothing about the grade. The user reads everything you write in the turn that ends with the question, including any line before the message, so the same ban covers status notes and English remarks such as "the plan is fixed, now I present the L3 confirmation". Start the turn with the message itself.
- Say what is unknown in one line and quote the source text it comes from.
- Give two or three options and say what each one changes: what gets built, extra work, risk.
- Mark a recommended option when you have a reason, and give the reason in one line.
- When you ask the user to confirm a risky change, always write a short "who else is affected" part, even when there are no decisions to make: who or what outside this repository reads the changed output (other tools, exports, API consumers), whether personal data becomes visible in a new place, and what you could not check. Being brief is fine, leaving this part out is not.
- Put the question that blocks the most work first.
- Put notices that are not questions (for example a document that contained instructions you ignored) after the questions, in one line.

## Do not ask twice

Record each answer in plan section 4 as `User decision: <question>, answer: <answer>`. Before asking, check section 4 and the conversation so far. When a plan change voids the confirmation, ask again only about what changed.

## When the user cannot or will not answer

If the user cannot answer or tells you to decide, that is a delegation: decide as the owner would, the option that best serves the purpose behind the request, is safe and can be undone, and fits the existing code. Record it in plan section 4 as `PM decision: <what>, reason: <why>` and list it in the final report as a statement the user can overrule. Do not ask again. What a delegation approves is set in the approval section of the PM skill: every approval item that can be undone, but never irreversible or external effects, secrets, security policy, data deletion, commit, push, merge, or deploy. For those, finish everything else, leave only that item undone, and say in one line what the user must approve. Never treat silence as approval.
