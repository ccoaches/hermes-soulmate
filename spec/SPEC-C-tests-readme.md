# SPEC C — Test Harness + README (executor: MiMo v2.5)

Read `spec/CONTRACT.md` first. Deliverables (create dirs as needed), touch NOTHING else:
1. `tests/validate.mjs`
2. `README.md`

## 1. tests/validate.mjs — Node, zero npm deps, run with `node tests/validate.mjs`
It validates the finished app + content pack. Structure it as small named check functions,
collect failures, print `PASS n/n` or `FAIL` with a list, exit code 0/1. Checks:

A. **Content pack** (`content/content-pack.json`): parses as JSON; has version, steps (9, ids
   exactly `identity,assets,resources,work,goals,guardrails,rhythm,fleet,review`), roleCatalog
   (>=15, each soulTemplateId present in soulLibrary), derivationRules (every roleId exists in
   roleCatalog; no rule for `orchestrator`), modelCatalog (every entry has costTier),
   toolCatalog, soulLibrary. Skip gracefully with a warning if file absent.
B. **index.html** (`web/index.html`): file exists and is < 400KB; contains
   `<script id="content-pack" type="application/json">`; the embedded JSON parses and passes
   the same checks as A; contains NO external references — regex-scan for
   `https?://` inside `src=`, `href=` (allow `href="#`, `href="https://example.com`
   and `href="https://github.com` plain links only), and any `fetch(`, `XMLHttpRequest`,
   `@import`, `<link rel="stylesheet" href="http`.
C. **YAML emitter sanity**: extract nothing from the app; instead implement a ~30-line
   mini YAML *parser check*: given sample strings with `: # [ ] { }` chars, assert the
   quoting rules from CONTRACT.md would be required (this documents the rule). Keep simple.
D. **Secret hygiene**: index.html and content pack contain no strings matching
   `sk-[A-Za-z0-9]{10,}`, `ghp_[A-Za-z0-9]{10,}`, `xoxb-`, `AKIA[0-9A-Z]{16}`.

If `web/index.html` doesn't exist yet, print `WARN index.html not built yet` and only run A —
still exit 0 so the harness can run before the app lands.

## 2. README.md — for the public repo (this will be published)
Sections: what it is (intake wizard → complete Hermes multi-agent deployment spec),
live demo placeholder link (the project site — mark "coming soon"), quick start
(open web/index.html, answer the interview, download setup-fleet.sh, run it on the Hermes host),
what gets generated (the exact file tree from CONTRACT.md §"Generated output"), safety model
(no secrets collected, fail-closed gates, .env never overwritten, backup-before-write),
relationship to hermes-agent (NousResearch) and Merlin's Loop, development (`node tests/validate.mjs`),
license MIT. Voice: direct, no hype; banned words per CONTRACT.md.

## Acceptance (run yourself)
- `node tests/validate.mjs` runs clean on the current repo state (content pack may or may not
  exist yet — both paths must work).
- README contains no invented URLs beyond the two named above, no secrets, no banned words.
