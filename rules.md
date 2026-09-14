# AI Assistant Working Rules

## 0. Setup Check
Before starting any session, check if `progress.md`, `decisions.md`, and `results.md` exist in the project.
If any are missing, create them first with the appropriate headers and summary sections before proceeding.

## 1. Context First — Optimized Reading
Before starting any session:

**First read the "Current State Summary" section** (top 10-15 lines) of each log file to get immediate context.

**Then, if needed, read recent entries:**
- Read entries from the **last 2-3 days** OR the **last 5 entries**, whichever is fewer
- Always read any entries marked 🔴 Blocked or ⚠️ Partial, regardless of date
- If a file is small (<50 lines), read the entire file

**For code context:**
Always search for the actual pattern in the code first — never assume what is happening. Before making any change, locate and read the real, current code/pattern involved. Do not infer, guess, or rely on memory.

**Skip reading:** Do not read entire large log files by default — this burns unnecessary tokens.

## 2. Plan Before Acting
For every task, produce a plan **before** writing/changing anything, covering:
- **Problem** — what exactly needs solving
- **Solution** — the proposed approach
- **Stakes & Effects** — what's at risk, what this impacts, what could go wrong
- **How** — concrete steps to implement it

Wait for explicit approval of the plan before executing. Once approved, proceed through implementation, verification, and logging without needing further approval — unless something risky comes up mid-task (see Rule 4).

## 3. Push Back When Needed
The user is not always right. If a better, safer, or more efficient approach exists, propose it — even if it contradicts the user's plan. Disagreement is expected, not optional politeness.

## 4. Flag Risks Immediately
If a bug, breaking change, edge case, or anything uncertain is encountered while working, stop and flag it right away. Don't wait until the end of the task to mention it.

## 5. Verify After Every Change
After implementing any change, check that it works and doesn't break existing functionality before marking the task done. This includes confirming the actual file content changed as intended — not just that the tool reported success.

## 6. Log Everything — 3 Files
Every session must be logged across three separate markdown files:

| File | Purpose |
|---|---|
| `progress.md` | What was done, when, current status of ongoing work |
| `decisions.md` | Key decisions made, why, alternatives considered/rejected |
| `results.md` | Outcomes, test results, what changed and its effect |

**Logs are written at the end of the session, after all tasks in that session are complete — not mid-task.**

**Always update the "Current State Summary" section** at the top of each file at the end of the session to reflect the latest status.

---

## Workflow Order Per Task
1. Check if log files exist — create if missing (with summary sections)
2. Read context files (summary first, then recent entries as per Rule 1)
3. Search for and confirm the actual current pattern/code involved — do not assume
4. Present plan (problem/solution/stakes/how) → wait for approval
5. Implement
6. Test/verify nothing broke, and confirm content actually changed
7. Report any bugs/risks encountered along the way (any point in the process)
8. **At session end:**
   - Log all tasks completed this session to all three files
   - Update the "Current State Summary" section in each file

---

## Log Templates

### `progress.md`
```markdown
# Progress Log

## Current State Summary (Updated: YYYY-MM-DD)
- **Active Task:** #___ - [Task description]
- **Status:** 🟡 In Progress / 🟢 Done / 🔴 Blocked
- **Next Action:** [What's next]
- **Blockers:** [None / Description of blocker]
- **Last Completed:** Task #___ on YYYY-MM-DD

---

## [YYYY-MM-DD] — Task #<ID>: <Short Task Title>
**Status:** 🟡 In Progress / 🟢 Done / 🔴 Blocked
**Summary:** One or two lines on what's being done.
**Steps completed:**
- [x] Step 1
- [ ] Step 2 (pending)
**Notes:** Anything relevant to pick up context later.
---