# SPEC B v2 — The Wizard App (executor: GLM 5.1)

Read `spec/CONTRACT.md` FIRST (v2) and follow it exactly. Your ONLY deliverable is `web/index.html`.
Do not modify any other file. Everything inline: CSS, JS, content pack. No build step.

## Inputs to read before writing code
1. `spec/CONTRACT.md` — steps, schemas, output formats, hard constraints.
2. `content/content-pack.json` — embed VERBATIM in
   `<script id="content-pack" type="application/json">…</script>`, parse at boot.
   If a structural gap blocks you, patch minimally at embed time and list every patch in your
   final report (do not edit the source json file).
3. A prior single-file wizard (external, not included) — copy the design language
   (palette, typography, spacing, header/footer, buttons). Same brand family, new tool.
4. a real live-fleet profile (kept private) — generated files must look like this.

## App architecture (plain JS, one file, comment-banner sections)
- **State**: single `state` object: `answers` keyed `<stepId>.<fieldId>` (repeater fields hold
  arrays of objects), `tiers` per sensitive block, `fleet: []` (derived then user-edited agent
  configs). Persist to localStorage (`hermes-intake-wizard.v2`) on every change; restore on
  load; "Start over" clears with confirm.
- **Engine**: renders steps from the content pack. Generic field renderer for
  text/textarea/select/multiselect/toggle/number/chips; `repeater` renders add/remove rows of
  its nested fields (e.g. one row per machine, person, domain, subscription). `showIf`
  conditional display. EVERY step gets a visible "Skip this section" control and NO field is
  ever required — skipped steps record `skipped: true`, derivation treats them as empty.
  Missing basics fall back to defaults: fleet name `my-fleet`, owner `Owner`, timezone from
  `Intl.DateTimeFormat().resolvedOptions().timeZone` (client-side). Sensitive steps render the
  tier selector (fleet-visible / specific-agents / isolated) with plain-language explanation
  plus a note that skipping entirely is always fine. Progress bar +
  clickable dots. Prominent "Nothing you type leaves this page" note in the header.
- **Derivation engine** (step `fleet`): evaluate `derivationRules` against answers
  (`minCount` counts repeater rows/multiselect picks; `equals`/`includes`/`truthy` per contract;
  `anyOf`/`allOf` combinators). Orchestrator always first. Render recommended agents as
  editable cards: name (prefilled from role, editable), emoji, mission (template resolved,
  editable textarea), model select (modelCatalog, default respecting the user's budget tier
  and available access from step `resources` — never default to a provider they said they
  don't have), tools, tier, schedule (cron presets: daily-morning/daily-evening/weekly/custom,
  times localized to their stated timezone), and the rule's `reason` line ("why you got this
  card"). Add-agent button offers the full roleCatalog. Removing a card is fine; the
  orchestrator card warns but can be renamed, not removed.
- **Generators** (pure functions `state → [{path, content}]`):
  - `genFleetYaml`, `genProfileYaml`, `genConfigYaml` (model/provider/base_url from card;
    `agent.max_turns: 60`, `agent.reasoning_effort: medium`, `memory.user_profile_enabled: true`,
    and the `tool_loop_guardrails` block from the reference profile verbatim),
    `genSoulMd` (soulLibrary template for the card's role, placeholders filled, exact section
    order from CONTRACT.md), `genAgentsMd` (Allowed/Denied/Approval/Runtime from card
    boundaries + gates + the per-machine permission map from step `assets`; denied scope
    ALWAYS includes secrets exposure, unapproved posting/sending, moving money, off-limits
    machines), `genEnvExample` (key NAMES from provider + tools, values empty),
    `genCronJson` (only if scheduled; shape from
    `Desktop\loop-wizard\templates\scaffold-hermes\cron.json`),
    `genUserMd` (per agent: interview answers relevant to that agent's role and tier —
    isolated-tier blocks appear ONLY in agents granted that tier; sections: Owner / Key People /
    Assets in scope / Goals / Preferences & style / Red lines; the user's pet peeves become
    literal "Never:" lines), `genSetupSh`, `genDeploymentMd` (opens with bold privacy warning).
  - Tiny YAML emitter helper implementing CONTRACT.md quoting rules — every YAML value goes
    through it, no hand-concatenation.
  - `genSetupSh`: `#!/usr/bin/env sh`, `set -eu`, quoted-delimiter heredocs (`<<'EOF_x'`,
    unique per file), backup existing profile dir to `<dir>.bak.$(date +%s)`, never write
    `.env` (only `.env.example`), final next-steps echo. Fleet/agent names sanitized `[a-z0-9-]`.
- **Review step**: file-tree sidebar → click to preview (escaped, monospace); per-file Copy +
  Download; "Download setup-fleet.sh"; "Download all (.zip)" via inline STORE-only zip writer
  (~80 lines: local headers + central directory + CRC32 table, no libs) — if the zip writer
  isn't solid, ship without the button rather than ship it broken. Repeat the privacy warning.
- **Header/footer**: tool name "Hermes Fleet Intake", link to
  github.com/NousResearch/hermes-agent (plain anchor), "Nothing leaves this page" note.

## Hard requirements
- Zero external requests (tests verify). No fetch, no CDN, no web fonts.
- Never collect secret values; `.env.example` names only.
- Escape ALL user input rendered into the DOM (single `esc()` helper, everywhere).
- Works from `file://` (no modules, no CORS-dependent features). Under 400KB total.
- Generic product: no real person's names/hosts/setups anywhere in UI copy or defaults.

## Acceptance (run yourself before reporting done)
1. `node tests/validate.mjs` → PASS (fix real findings in your file).
2. Embedded JSON parses:
   `node -e "const h=require('fs').readFileSync('web/index.html','utf8');const m=h.match(/<script id=\"content-pack\"[^>]*>([\s\S]*?)<\/script>/);JSON.parse(m[1]);console.log('OK')"`
3. Report: what you built, every content-pack patch, any spec deviation and why.
