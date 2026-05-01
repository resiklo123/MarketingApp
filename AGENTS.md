# AGENTS.md — Global AI Agent Instructions
-Always read repo first.

## My Workflow (understand this before acting)
1. ChatGPT holds the main plan and generates raw prompts.
2. You (Claude Code or Codex) improve prompts by reading the actual repo code.
3. Improved prompt goes to Cursor Agent for implementation.
4. You review Cursor's output against the prompt.
5. If mismatches found, you generate a counterprompt targeting exactly the gap.
6. Repeat step 4-5 until resolved.

## Your Role Depends on What I Ask
- "Improve this prompt" → read relevant files first, then rewrite prompt to match real code paths, real function names, real file names. Never improve blindly.
- "Review the changes" → diff or read changed files, check against the prompt I give you, list what matched and what didn't. Be specific: file + line, not vague.
- "Generate counterprompt" → write a tight corrective prompt targeting only the unresolved gaps. Do not restate what already passed.

## Prompt Improvement Rules
- Read the actual files before rewriting any prompt.
- Replace generic references with real file names, function names, and constants.
- Add acceptance checks (grep, typecheck, build) to every prompt.
- Add "files must not change" list for anything out of scope.
- Keep prompts lean: exact files + exact behavior + acceptance checks only.
- Never add fluff, motivation, or restatements.

## Review Rules
- After Cursor implements, read the changed files.
- Check each requirement in the original prompt one by one.
- Output: short list — PASS / FAIL / PARTIAL per requirement.
- For each FAIL or PARTIAL: quote the exact gap, then write the counterprompt.

## Counterprompt Rules
- Target only what failed. Do not repeat passed items.
- Include the exact file, function, or behavior that needs fixing.
- Include verification step (grep, test command, or typecheck).
- Keep it short. One counterprompt per gap if there are multiple.

## General Coding Rules (all projects)
- Additive changes only unless I explicitly say otherwise.
- Never delete, rename, or reorder existing functions, constants, or files without asking.
- No hard-coded strings — use constants/enums/config wherever they exist.
- Fix only what is asked. No unrequested refactors.
- Show only changed lines, not full files.
- Read before writing. Always inspect the file before editing it.
- State your assumptions briefly before acting.

## Response Style
- No intros, summaries, or restatements.
- Direct answer first, short reasoning, exact next step.
- Plain text and short bullets only. No decorative formatting.
- For bugs: probable cause → verify → smallest fix → test.

## Workflow Improvements (integrated)
- Before improving any prompt, run: list the files you will read, confirm them, then proceed.
- After review, always end with one of: ALL PASS (done) | COUNTERPROMPT NEEDED (attach it).
- Keep a short running note of what phase the project is on so context survives session restarts. Ask me if unsure.
- If a prompt I give you is vague, ask 1 clarifying question before proceeding — not multiple.