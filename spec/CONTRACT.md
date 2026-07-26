# Hermes Intake Wizard — Shared Contract v2 (read first, do not deviate)

Project root: `./` (this repository).

## What is being built
A self-contained, publishable single-file web app (`web/index.html`) — the **Hermes Fleet Intake Wizard**.
It is for ANYONE setting up a Hermes instance, not one specific user. It runs a deep personal
interview ("family-office onboarding, not a signup form"), derives a RECOMMENDED multi-agent
fleet from the answers, lets the user edit it, and generates a **complete Hermes multi-agent
deployment spec** tailored to that person: fleet manifest + one full profile bundle per agent +
per-profile USER context pack + installer script + human-readable deployment doc.

100% client-side. A visible promise in the UI: "Nothing you type leaves this page."

## Ground truth (reuse, never invent)
- Real Hermes profile anatomy: a real profile from a live fleet (kept private).
  A profile dir contains: `profile.yaml` (description, description_auto), `config.yaml`
  (model.default / model.provider / model.base_url, agent.max_turns, agent.reasoning_effort,
  tool_loop_guardrails, compression, memory incl. user_profile_enabled), `SOUL.md`, `AGENTS.md`,
  `.env` (keys only).
- SOUL.md section order (from live profile): frontmatter (status/role/name) then
  `# <Name> SOUL` → `## Identity` → `## Mission` → `## Boundaries` → `## Tools` → `## Memory`
  → `## Handoffs` → `## Approval` → `## Style` → `## Refusal`.
- AGENTS.md shape: `# <Name> Operating Context` → Profile role / Allowed scope / Denied scope /
  Approval rule / Runtime (bulleted, terse, fail-closed).
- Loop shape for scheduled agents: a prior loop template (external, not included)
  and its scaffold template set (SOUL.md,
  config.yaml, cron.json, distribution.yaml).
- Design language: copied from a prior single-file wizard (external, not included)
  (dark/cyan, self-contained CSS, zero external requests).

## Interview steps (fixed ids/order — content pack supplies all copy/fields)
EVERY block is SKIPPABLE with a visible "Skip this section" affordance — no field anywhere is
required. Someone who skips everything still gets a valid minimal fleet from defaults:
fleet name `my-fleet`, owner `Owner`, timezone auto-detected client-side
(`Intl.DateTimeFormat().resolvedOptions().timeZone`), orchestrator + news-digest starter roster.
The intro copy states the trade plainly: answer more, get a more tailored fleet — share only
what you're comfortable with.
Sensitive blocks carry a per-block sensitivity selector: `fleet-visible` / `specific-agents` /
`isolated` (default for health/family/money: `isolated`).

1. `identity` — full name, preferred name, birthday, city/country/timezone, languages;
   household: spouse/partner (name, birthday, occupation, what fleet handles for them),
   kids (names, ages, schools, activities), extended family check-ins, pets (vet, meds);
   home (own/rent, projects, recurring maintenance); important dates (anniversaries,
   renewals: insurance/passports/licenses/domains, tax deadlines).
2. `assets` — hardware fleet: every machine (name, OS, role: daily-driver/always-on-server/
   AI-rig/laptop, GPU/VRAM/RAM, reachability: LAN/Tailscale/SSH) + per-machine permission
   (may-touch / read-only / off-limits); phones, NAS, network, smart-home; digital assets:
   domains+registrars+renewals, sites+hosting, GitHub/GitLab orgs+key repos (public/private),
   social accounts (platform, handle, post-permission default NO), email accounts+purposes,
   cloud providers, crypto wallets/exchanges (names only, watch-only); property, vehicles
   (service/registration dates), valuables; licenses & SaaS subscriptions with costs.
3. `resources` — LLM access: OAuth subscriptions (ChatGPT/Codex, X Premium/Grok, Gemini,
   Claude subscription — note: no headless/programmatic use, interactive only), API-key
   providers (NAMES only, never values), local models (Ollama/llama.cpp/base URLs, GPU);
   which machine hosts Hermes; monthly AI budget comfort tier ($0-local-only / light / medium /
   premium) — drives model routing defaults.
4. `work` — occupation/roles (multi-select: employee/founder/trader/creator/retiree/student/
   parent/other); business(es): name, what it does, role, team size, current stack (GitHub,
   Notion, Google Workspace, Slack, QuickBooks…); key work people (partners, assistants,
   clients: name + what fleet does regarding them); THE GRIND LIST — recurring tasks that eat
   hours (email triage, reports, research, content, invoices, bookkeeping, scheduling…)
   as selectable chips + free text; the human-only zone (never automate).
5. `goals` — top 3 goals ~12-month horizon; domains to monitor (markets, AI, industry, sports,
   local, hobbies); personal ops opt-ins: health/fitness (conditions, meds+refills, doctors,
   routine, sleep, diet), family logistics, travel, home projects; money context (institution
   NAMES only: banks/brokers/retirement; income streams; bills to watch; insurance renewals;
   subscription-audit interest).
6. `guardrails` — autonomy dial PER DOMAIN (observe-only / draft-for-approval / act-with-gates /
   full-auto); hard red lines as pre-CHECKED boxes the user must deliberately uncheck
   (move money, post publicly, email real people, delete files, touch off-limits machines);
   approval channel (Discord/Telegram/Slack/email) + approval token slug format
   (default `<OWNER>_APPROVED_<AGENT>:<slug>`); privacy tier review (shows what's isolated).
7. `rhythm` — morning brief / evening digest (contents, channel, time, using their timezone);
   quiet hours; weekly review day; fleet personality/voice (formal/casual/direct — maps to
   Hermes personality + Style sections); how they like info (bullets vs prose, direct vs gentle);
   pet peeves (repeating yourself, permission-asking, hype) → "never do X" style lines.
8. `fleet` — THE PAYOFF: wizard derives a recommended roster from all answers via the
   derivation rules in the content pack; always includes one orchestrator/chief-of-staff;
   shows editable agent cards (add/remove/rename, change model, adjust mission); each card
   states WHY it was recommended ("you listed 14 subscriptions → Subscription Auditor").
9. `review` — full file-tree preview of every generated file, per-file copy/download,
   setup-fleet.sh download, zip download; loud privacy warning.

## Content pack JSON schema (kimi produces `content/content-pack.json`; app embeds verbatim)
```json
{
  "version": "2.0",
  "steps": [ { "id": "identity", "title": "…", "intro": "…", "skippable": false,
    "sensitivity": true,
    "fields": [ { "id": "…", "type": "text|textarea|select|multiselect|toggle|number|chips|
                  repeater|per-agent", "label": "…", "help": "…", "placeholder": "…",
                  "options": [{"value":"","label":""}], "default": null, "required": false,
                  "showIf": {"fieldId": "value"},
                  "fields": [ /* for repeater (e.g. one entry per machine/person) and per-agent */ ] } ] } ],
  "roleCatalog": [ { "id": "orchestrator", "name": "Chief of Staff", "emoji": "🎯",
      "description": "…", "missionTemplate": "…", "defaultTools": ["kanban"],
      "boundaries": {"may_touch": [], "read_only": [], "forbidden": []},
      "humanGates": ["…"], "soulTemplateId": "orchestrator", "defaultTier": "fleet-visible",
      "suggestedScheduleCron": null } ],
  "derivationRules": [ { "roleId": "subscription-auditor",
      "when": {"anyOf": [{"field": "assets.subscriptions", "minCount": 3}]},
      "reason": "You listed {{count}} subscriptions — a monthly audit loop pays for itself." } ],
  "modelCatalog": [ { "id": "gpt-5.5", "provider": "openai-codex", "label": "GPT-5.5 (ChatGPT/Codex OAuth)", "kind": "oauth", "costTier": "subscription" } ],
  "toolCatalog": [ { "id": "kanban", "label": "Kanban", "riskLevel": "low", "gateAdvice": "…" } ],
  "soulLibrary": { "<soulTemplateId>": { "identity": "…", "boundaries": "…", "tools": "…",
      "memory": "…", "handoffs": "…", "approval": "…", "style": "…", "refusal": "…" } }
}
```
Placeholders in templates: `{{agentName}}`, `{{fleetName}}`, `{{ownerName}}`, `{{mission}}`,
`{{gates}}`, `{{mayTouch}}`, `{{readOnly}}`, `{{forbidden}}`, `{{approvalToken}}`, `{{tier}}`.
`derivationRules.when` supports: `{"field": "<stepId>.<fieldId>", "minCount": n}`,
`{"equals": v}`, `{"includes": v}`, `{"truthy": true}`; combined with `anyOf`/`allOf`.
The orchestrator role has NO rule — always included.

## Generated output (the deployment spec)
- `fleet.yaml` — manifest: fleet name, owner, host machine, timezone, agents (name, role,
  model, provider, tier, schedule), channels, handoff pairs, approval token format,
  machine permission map.
- Per agent `profiles/<agent>/`: `profile.yaml`, `config.yaml`, `SOUL.md`, `AGENTS.md`,
  `.env.example` (key NAMES only, values empty), `USER.md`, and `cron.json` if scheduled.
  - **USER.md** = the tailoring payoff: the interview answers relevant to THIS agent,
    filtered by sensitivity tier (isolated blocks appear ONLY in agents granted that tier),
    organized as: Owner / Key People / Assets in scope / Goals / Preferences & style /
    Red lines. Every profile's config.yaml sets `memory.user_profile_enabled: true`.
- `setup-fleet.sh` — POSIX self-extracting installer: `set -eu`, quoted-delimiter heredocs,
  writes into `~/.hermes/profiles/<agent>/`, backs up existing dirs to `<dir>.bak.$(date +%s)`,
  NEVER writes `.env` (only `.env.example`), prints next-steps summary. Names sanitized
  to `[a-z0-9-]`.
- `DEPLOYMENT.md` — human-readable full spec, opening with a bold privacy warning:
  contains personal data, keep out of public repos.

## Hard constraints (all executors)
- ZERO external requests: no CDNs, fonts, analytics, fetch. Single file, inline everything.
- Never ask for or emit secret VALUES (API keys, passwords, wallet keys). Names only.
- Fail-closed defaults everywhere; red lines pre-checked; external actions gated by default.
- Valid YAML output: 2-space indent, quote strings containing `: # { } [ ]` or edge spaces.
- Plain JS, no build step, no frameworks; works from `file://`; localStorage persistence.
- Generic product voice: direct, confident, no hype. Banned: "game-changer", "revolutionary",
  "leverage" (verb). No references to any specific person's setup — fully generic examples
  (e.g. "Alex", "Jordan") in placeholder text.
