# SPEC A v2 — Content Pack (executor: Kimi K2.6)

Read `spec/CONTRACT.md` first (v2 — personal-interview architecture). Your ONLY deliverable is
`content/content-pack.json` (create `content/`). Do not touch any other file. JSON only, no code.

## Task
Produce the complete content pack per CONTRACT.md §"Content pack JSON schema":

1. **steps** — all 9 steps, ids exactly:
   `identity, assets, resources, work, goals, guardrails, rhythm, fleet, review`.
   Every field from CONTRACT.md's step descriptions fully specified: label, help text
   (help text should explain WHY the fleet needs this, one sentence), placeholder with a
   generic example person ("Alex"), sensible default, required flag. Use `repeater` for
   list-of-things fields (people, machines, domains, subscriptions, goals, income streams…)
   with nested `fields`. ALL steps are skippable and NO field is required — set
   `"skippable": true` and `"required": false` everywhere (`fleet`/`review` are app-rendered
   payoff steps — give them title+intro only, fields: []).
   Sensitive steps (`identity` household/dates, `goals` health/money) set `"sensitivity": true`.
2. **roleCatalog** — ~18 generic roles anyone might need. Required: orchestrator (chief of
   staff — always included), researcher/analyst, inbox-triage, scheduler/calendar-sentinel
   (dates, renewals, birthdays), subscription-auditor, finance-watcher (watch-only),
   health-companion, family-ops, home-maintenance, content-publisher (gated), social-media
   (gated, draft-only default), dev/engineering, business-ops, news-digest, travel-planner,
   learning-coach, fleet-custodian (memory/self-maintenance), custom (blank). Each fully
   populated per schema; boundaries conservative; `forbidden` ALWAYS includes: exposing
   secrets, unapproved external posting/sending, moving money, touching off-limits machines.
   Gated roles get humanGates + approval-token usage. Sensible `defaultTier` (health-companion,
   family-ops, finance-watcher → `isolated`).
3. **derivationRules** — one per non-orchestrator role, keyed to interview fields, each with a
   human `reason` string using `{{count}}` where apt (e.g. subscriptions >=3 → subscription-
   auditor; kids >=1 or spouse → family-ops; meds/conditions given → health-companion;
   grind-list includes email-triage → inbox-triage; monitors any domain → news-digest;
   business named → business-ops; repos listed → dev; social accounts → social-media (draft-only);
   important dates >=3 → scheduler; property/home projects → home-maintenance; travel opt-in →
   travel-planner; learning goal → learning-coach; institutions listed → finance-watcher;
   always suggest fleet-custodian when agents >= 4).
4. **modelCatalog** — generic, provider-accurate: OAuth-subscription entries (GPT-5.5 via
   ChatGPT/Codex OAuth; Grok via X Premium OAuth; Gemini via Google sub), API-key entries
   (Anthropic Claude API, OpenAI API, Google API, Kimi K2.6/GLM 5.1/MiniMax/MiMo via
   OpenAI-compatible endpoints), local entries (Ollama, llama.cpp — kind local, note
   "set base_url", costTier "free"). Include an honest `costTier` on each
   (free/subscription/budget/premium). Note on Claude subscription: interactive-only, cannot
   drive headless agents. Do not invent model version numbers you're unsure of — use the ones
   listed here.
5. **toolCatalog** — ~14 entries with honest riskLevel + one-line gateAdvice: kanban, file-read,
   file-write, shell, browser, web-search, discord, telegram, slack, email, github,
   memory store, scheduler/cron, custom-mcp.
6. **soulLibrary** — one entry per soulTemplateId (one per role): 2–4 sentences per section
   (identity, boundaries, tools, memory, handoffs, approval, style, refusal) using the
   `{{placeholder}}` tokens. Refusal sections blunt: deny-and-report (`DENIED` pattern).
   Style sections must consume `{{tier}}`-appropriate discretion for isolated roles.

## Acceptance (run yourself before finishing)
- `node -e "JSON.parse(require('fs').readFileSync('content/content-pack.json','utf8'));console.log('OK')"` → OK.
- Every roleCatalog `soulTemplateId` exists in soulLibrary; every derivationRule `roleId`
  exists in roleCatalog; orchestrator has NO derivation rule; every step field type is an
  allowed type; step ids exact.
- Zero secret values; zero banned words; zero references to any real person/company setup;
  terse direct copy throughout.
