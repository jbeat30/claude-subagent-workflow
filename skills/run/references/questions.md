# Question policy

Applies to every question the PM puts to the user, whether it comes from the PM itself, an agent's `needs-input`, a mandatory approval trigger, or the UI verification rules. The goal is to ask when asking is needed and to ask once, in words the user can answer.

## Look before asking

Do not ask what the request source, the repository, the profile, the rule files, or the installed library docs already answer. Read or search first and ask only what is still open. Never fill a gap by guessing.

## When to ask

- The answer could change what is built, which interpretation of the request applies, or whether a risky action proceeds (the mandatory approval triggers).
- The answer is something only the user has: a preference, a business or policy decision, an external fact, or a tool or environment.
- The request leaves open what to build (which kind, which value, where it applies) and nothing in the repository or the rules settles it, for example "add a discount" with no kind, rate, or scope. Ask before you touch any file, after the four steps in "Foresee and bundle" so the options include the design that delivers the outcome. Choosing a design for the user and building it is what this policy exists to prevent, even when the grade is L2 and every choice looks reasonable.

## When not to ask

- The choice is a style or detail the project's own rules or the profile conventions already settle.
- Every option gives the same result for this request. Pick the one that matches the existing code and record it in plan section 4 as an assumption.
- The answer would only add verification work and could not change finished work. Hold it for the one message at the end (`${CLAUDE_PLUGIN_ROOT}/references/ui-verification.md`).
- The user already handed the decision to you in the request ("just handle it", "decide for me"). Then the open points above are yours to decide: take the design you would have recommended, choose a sensible value where one is missing, build it, and report each choice and where to change it (see "Foresee and bundle"). Ask only what a delegation cannot approve (see "When the user cannot or will not answer").

## One message per moment

Put every open question of the same moment in one message, not one at a time. At G2 fold these into the confirmation message: the planner's user question list, agents' `needs-input` questions, UI verification ambiguities, and approval items. Merge duplicates: the same question from two agents is one question. Mid-run, ask at once only when the answer could change finished work; otherwise hold the question for the next gate or the final report.

## Foresee and bundle

Before you write a question message, including one you send before planning, do these four steps in order.
1. Outcome: say to yourself what the user will see change in the real flow when this works, and who or what will call the new behavior. Read the callers.
2. Design: pick the design that delivers that outcome. It is the option you recommend, and the one you build if the user hands the decision to you.
3. Conflicts: check that design against the existing tests, callers, and rules. If it changes something they protect, for example the value an existing test asserts, it stays in the message as an option, with one line saying what must be allowed ("the existing test expects the old total; its expected value would be updated to the new required one, nothing weakened or deleted"). Do not drop it because a rule seems to forbid it, and do not swap in a smaller design that leaves the new behavior uncalled. Offer the smaller design as another option and say in one line what it leaves unconnected. Also check the design against what the user already said in this conversation (for example "do not touch the existing tests"). If the design you will recommend conflicts with it, say so next to the recommendation and let the user choose.
Example from another project: the request is "add a shipping fee to the checkout total", and the function that computes the checkout total is called only by one test that asserts the old total. The option that delivers the outcome changes that function itself and updates the test's expected value. "Add an optional fee parameter that nothing passes" leaves the fee unused.
4. Check: for the design you will recommend, write one line: what changes for the user once it is built and the product is used as usual. If nothing changes because the new behavior stays off until some caller turns it on, and no caller does, it is not a design that delivers the outcome. Change it (turn the behavior on by default, or connect the caller) before you send, or recommend another design.
Give every option in the message the same line, "once built and used as usual, you will see: ...", so the user can compare. An option whose line says nothing changes may stay in the message, but it is never the recommended one, and "the existing tests and behavior stay as they are" is never the reason for recommending an option. An existing test expectation that must change because the requested behavior changed is an update, not a weakening: the message says so in one line.
A value the user did not give (a rate, an amount, a limit) is never a reason to leave the behavior off or behind an optional parameter. Recommend the design with the behavior on, and ask for the value in the same decision, with a suggested value. If you end up building with a value the user did not give (they delegated, or did not answer that point), the final report says which value you used, that you chose it because none was given, and the exact place (file and name) where the user can change it.
What you recommend is what you build. If building shows that the recommended design cannot deliver the outcome, build the design that does, and say what changed and why in the final report.
When the open points depend on each other (what kind, what value, where it applies, what it does to existing tests), do not ask them as separate small questions. Ask one decision whose options are complete designs the user can pick whole, and mark the recommended design.

## Split decisions from defaults

Show the user two separate lists in the message: the decisions only the user can make, and the defaults you will use unless told otherwise. A decision is something where the options lead to clearly different results and no existing code or rule picks one. A detail with a safe default belongs in the defaults list, not in the questions: input limits and error handling, naming, internal structure, file placement, and anything the existing code already does one way. When the request already names what to build and gives the values (which options, which numbers, which return shape), it is a clear request: ask no decisions at all. Edge cases the request left open, such as whether an end date includes the whole last day, what happens when a deduction exceeds the total, empty or out-of-range input, error shape, and rounding, are defaults. Choose the safe one, list it in the final report as something you decided, and build. A question must offer real options; if you only want the user to confirm how you read the request, write it in the defaults list as "I read this as ..." and do not put it among the decisions. Ask at most three decisions per message; if more remain, ask the ones that block the most work and put the rest in the defaults list with your recommendation. Say once that "go with your recommendations" is a valid answer, and use the same words every time so the user always sees the same phrase: in English, `you can answer "go with your recommendations"`; in Korean, copy exactly the sentence printed after `Korean answer hint` in the output of the grade command, and only if you cannot see that line, output exactly the Hangul text that this escape string decodes to: `\uCD94\uCC9C\uB300\uB85C \uC9C4\uD589\uD574\uC918\uB77C\uACE0\uB9CC \uB2F5\uD558\uC154\uB3C4 \uB429\uB2C8\uB2E4` (each `\uXXXX` is one character; decode it and write only the decoded Hangul, never the escape codes, a romanization, a translation, or a note about the phrase). Use it with no quotation marks added and no extra words inside it. Do not paraphrase or shorten it ("the recommended option", "the suggested approach", "just say go ahead", or similar). The same phrase is required in an approval-only confirmation that has no decisions.

After the user has answered, or said to go with your recommendations, the final report is a report, never a question. Do not ask the user to pick or to tell you which is right ("let me know which one you want", "this must be decided first"), and do not use a "decision needed" heading. State what you decided as a plain statement, and add in one clause what changing it would involve ("if you want X instead, say so"). If something could only have been decided by the user, it was your job to ask it before building.

## Make each question answerable

- Use plain words. Never write grade names (Q, L1, L2, L3), gate names (G0 to G5), role names (`planner-agent`, `qa-agent`, and so on), `needs-input`, or `runId` in a message to the user. They are for your own records. Say what they mean instead: for L3 write "this change touches several areas and needs your confirmation first", for L2 write nothing about the grade. The user reads everything you write in the turn that ends with the question, including any line before the message, so the same ban covers status notes and English remarks such as "the plan is fixed, now I present the L3 confirmation". Start the turn with the message itself.
- Say what is unknown in one line and quote the source text it comes from.
- Give two or three options and say what each one changes: what gets built, extra work, risk.
- Mark a recommended option when you have a reason, and give the reason in one line. Only an option whose result shows up in normal use can be recommended.
- When you ask the user to confirm a risky change, always write a short "who else is affected" part, even when there are no decisions to make: who or what outside this repository reads the changed output (other tools, exports, API consumers), whether personal data becomes visible in a new place, and what you could not check. Being brief is fine, leaving this part out is not.
- Put the question that blocks the most work first.
- Put notices that are not questions (for example a document that contained instructions you ignored) after the questions, in one line.

## Do not ask twice

Record each answer in plan section 4 as `User decision: <question>, answer: <answer>`. Before asking, check section 4 and the conversation so far. When a plan change voids the confirmation, ask again only about what changed.

## When the user cannot or will not answer

If the user cannot answer or tells you to decide, that is a delegation: decide as the owner would, the option that best serves the purpose behind the request, is safe and can be undone, and fits the existing code. Record it in plan section 4 as `PM decision: <what>, reason: <why>` and list it in the final report as a statement the user can overrule. Do not ask again. A delegation never silently overrides an earlier explicit instruction from the user: if the two lead to different results, ask one short question that names both. What a delegation approves is set in the approval section of the PM skill: every approval item that can be undone, but never irreversible or external effects, secrets, security policy, data deletion, commit, push, merge, or deploy. For those, finish everything else, leave only that item undone, and say in one line what the user must approve. Never treat silence as approval.
