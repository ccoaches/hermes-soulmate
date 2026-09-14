# Hermes SoulMate

**Soulmate v2 is an interactive Hermes setup wizard.** It walks through the target
installation, models, memory services, knowledge vaults, tools, channels, bots,
routines and the way you want Hermes to work with you.
The Hermes-centered interface uses warm gold, ivory and dark surfaces with a
winged emblem. Its visual assets are local to the wizard.

## Use it in your browser

**[Open the Hermes setup wizard](https://ccoaches.github.io/hermes-soulmate/)**

No download, repository copy, installation or account is needed. Choose the
essentials or complete setup, then answer one question at a time. The wizard
saves progress in that browser. Download your interview if you want to move to
another device or keep a backup; it does not sync answers between devices.

For a live conversation, choose **Interview with my agent → Download agent kit**
and attach the file to Claude, Codex, ChatGPT, Hermes or another agent. The kit
contains the questions, instructions and current answers. Ask the agent to return
the updated interview JSON, then import it here to continue.

Your answers are not sent to a server by the wizard. Exports contain your answers,
so share them deliberately. Never enter API keys or passwords. You receive a
setup plan and verification checklist; installation is a separate agent-assisted step.

### Privacy

The site owner does not receive interview answers. There is no sign-up, answer
submission, database, analytics, tracking pixel or model API connection. Answers
are saved in the visitor's own browser storage. **Start over** clears that saved
interview. Downloaded files remain wherever the visitor saved them.

Sharing an agent kit is the visitor's choice; their selected AI service then handles
that file under its own policies. GitHub Pages serves ordinary public site files and
may process standard hosting access information; questionnaire answers are not
included in those requests. The wizard itself collects no visitor information.

## Run a local copy (optional)

Requires Node.js 18 or newer. From this repository:

```bash
node v2/serve.mjs
```

Open **http://127.0.0.1:8787**. Choose the essentials or the complete setup, answer
one question at a time, and return later using saved progress. Review and edit
your choices, then download the portable interview and setup plan. If the port
is in use, pass another one: `node v2/serve.mjs 8788`.

The preview serves only the wizard's public files on your own machine. Answers
stay in this browser until you export them; exports contain your answers. No
model connection is required. Never enter API keys or passwords.

**Prefer a live conversation?** Point Claude, Codex, Hermes or another agent at
[`v2/START-HERE.md`](v2/START-HERE.md). It uses the same question catalog and session
format, asks you one question at a time, and can hand the interview back to the
browser. Agents without local file tools can use the guide and JSON format in
their own chat.

For an agent that cannot read your local files, choose **Interview with my agent →
Download agent kit**. Attach that kit in the agent's chat: it contains the guide,
question catalog and current interview together. Ask the agent to return the updated
interview JSON for browser import. Your local preview address is not a public URL.

The result is a **setup plan with unresolved requirements and verification steps**.
The browser does not install Hermes or claim your services are connected. The
agent handoff explains how to verify the target installation, prepare the actual
configuration and test the selected services. See [`v2/RESEARCH.md`](v2/RESEARCH.md)
for the community workflows and official configuration sources behind the wizard.

V2 verification:

```bash
node tests/v2-engine.mjs
node tests/v2-server.mjs
node tests/v2-browser.mjs
```

The browser test requires Playwright and Chrome (or a Playwright-installed Chromium).
Set `PLAYWRIGHT_CHANNEL=chrome` to select installed Chrome.

## Publish updates

The website is the `docs/` folder on `main`, published with GitHub Pages. After
editing `v2/`, run `node tools/build-site.mjs`, then `node tools/build-site.mjs --check`
and `node tests/site-build.mjs`. Commit both source and generated site. The build
copies only the public wizard files and creates a hash manifest; private interview
exports and local research captures are never part of the site build.

## Original questionnaire and fleet generator

The original standalone questionnaire remains at `web/index.html`. The following
documentation describes that earlier tool; its file-only launch and strict
`connect-src 'none'` policy differ from the v2 local preview above.

**The matchmaker for your agent fleet.**

A deep, dating-profile-grade interview that produces your perfect match: a complete
[Hermes](https://github.com/NousResearch/hermes-agent) multi-agent deployment spec, with
hand-forged SOULs, tailored to the person answering it.

**Every section is optional.** Share as much or as little personal detail as you see fit —
skip the lot and you still get a working starter fleet. The more you tell it, the more the
roster is actually yours.

One HTML file. No server, no build step, no frameworks, no dependencies.
**Nothing you type ever leaves your browser** — and you don't have to take our word for it (see below).

**Clone the repo and open `web/index.html` in any browser.** That single file is the whole tool —
no server, no build step, no install. Running it yourself is the point: you can watch, offline,
that nothing you type ever leaves your machine.

---

## Verifying that nothing leaves

The privacy claim is enforced by your browser, not asserted by us. `web/index.html` ships a
strict Content-Security-Policy:

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'
```

`connect-src 'none'` means every `fetch`, `XMLHttpRequest`, `WebSocket` and
`navigator.sendBeacon` is refused by the browser itself. `form-action 'none'` means nothing
can be POSTed anywhere. `default-src 'none'` means no external scripts, styles, fonts, or
images can load. There is no network code in the file — and this header means there *cannot* be,
even if a future commit introduced some by accident.

**Three ways to check, in increasing order of paranoia:**

1. **Watch it.** Open DevTools → Network, fill in the entire interview, download your spec.
   The request log stays empty.
2. **Pull the plug.** Disconnect from the internet. The wizard behaves identically.
3. **Prove it.** Run the adversarial test in this repo:

   ```bash
   npm install --no-save playwright && npx playwright install chromium
   node tests/no-network.mjs
   ```

   It loads the page from `file://`, fills the interview with personal data, generates the
   full spec, and records every network request the browser attempts. Then it actively tries
   to exfiltrate that data over fetch, XHR, WebSocket, sendBeacon and a tracking pixel, and
   asserts the CSP blocks every channel:

   ```
   ✓ interview filled and deployment spec generated — 37 files
   ✓ NORMAL USE: zero external requests even attempted
   ✓ CSP blocked fetch / XHR / WebSocket / sendBeacon — 4 connect-src violations
   ✓ CSP blocked the tracking pixel — 1 img-src violation
   ✓ no remote host ever responded
   ✓ every exfil attempt was blocked in flight
   ```

Your answers are held in `localStorage` so you can close the tab and come back. "Start over"
clears them. Nothing is ever transmitted.

The interview includes 36 additional optional questions, with new sections for **Projects &
Workflows**, **Content & Audience**, **Health & Wellbeing**, and **Family & Lifestyle**.
Existing sections also ask about values, decisions, business priorities, near-term goals,
memory preferences and check-ins. Goal rows include milestones and measures of success;
social account rows include audience and objectives. These answers appear as labelled context
in the permitted agents' `USER.md` files. Privacy tiers and skipped sections apply to the new
sections. Previously saved answers, custom fleets and interview progress are preserved.

## Quick start

```bash
git clone https://github.com/ccoaches/hermes-soulmate.git
cd hermes-soulmate
# open web/index.html in any browser
```

1. Answer the interview. **Every section is skippable** — answer more, get a more tailored fleet.
2. Review the recommended roster. Each agent card tells you *why* it was recommended, and
   everything is editable.
3. Download `setup-fleet.sh`, read it, and run it on your Hermes host.

## What gets generated

```
fleet.yaml              manifest: agents, channels, handoffs, and the routing table
FLEET-KNOWLEDGE.md      the fleet's shared truth: ownership, routing, decisions,
                        handoffs, verification, recovery, baseline
profiles/<agent>/
  profile.yaml          role and description
  config.yaml           model, provider, memory backend, delegation limits
  SOUL.md               the agent's operating charter — identity, stance,
                        accountability, pushback, autonomy (its hard line),
                        mission, boundaries, tools, memory, handoffs, approval,
                        tone, operating mode, delegation, standards, lookup,
                        escalation, self-improvement, refusal, end state
  AGENTS.md             operating context: allowed scope, denied scope, approval rule, runtime
  USER.md               who you are — filtered by sensitivity tier
  .env.example          key names only, values empty
  cron.json             schedule, for agents that run on a loop
setup-fleet.sh          POSIX installer: backs up existing profiles, never overwrites .env
DEPLOYMENT.md           the whole thing, human-readable
```

The architecture it generates: one command profile owns routing, approvals and every
high-risk credential; specialists own one durable lane each with isolated memory and no
messaging keys; subagents inherit nothing (`delegation.inherit_mcp_toolsets: false`); and
`FLEET-KNOWLEDGE.md` is the one place the fleet agrees on what is true.

`USER.md` is the payoff. It carries the parts of your interview each agent is entitled to see,
so your fleet knows you on day one instead of learning you cold.

## Safety model

- **No secrets are collected.** The wizard asks *which* providers you use, never for a key.
  Generated `.env.example` files contain key names with empty values.
- **Sensitivity tiers filter exports, not runtime access.** Sensitive identity, asset, work and
  goal answers default to `isolated`. Filtering applies across profile files and shared knowledge.
  `fleet-visible` reaches all profiles; `specific-agents` reaches that tier and `isolated`;
  `isolated` reaches only `isolated`. This is a legacy tier model, not individual agent ACLs.
  Skipped answers are omitted from exports but retained for editing when you return to a section.
  The fleet manifest, installer and deployment guide remain private operator artifacts.
- **Fail-closed guardrails.** Moving money, posting publicly, emailing real people, deleting
  files, and touching off-limits machines are denied by default in every generated `AGENTS.md`.
  You have to deliberately opt out of each red line.
- **The installer is conservative.** It backs up any existing profile directory to
  `<dir>.bak.N` before writing, choosing a free suffix on every run. It never writes a real `.env`.
  Shared fleet documents are installed and backed up too. Set `HERMES_HOME` to select the target;
  the default is `$HOME/.hermes`. Files are written with a restrictive `umask 077`.
- **Read the script.** `setup-fleet.sh` is plain POSIX shell with quoted heredocs. It is meant
  to be read before it is run.
- **Stable export identities.** Display names remain readable, empty names receive a fallback,
  and names that collide after path sanitization receive suffixes. The review shows the resolved
  names; routing, manifests, ZIP paths and installer all use the same result.
- **Deployment scaffold only.** The installer starts no agents or schedules. Generated schedules
  are disabled pending configuration. Verify the Hermes version/schema, provider IDs and login
  methods, tool connections, knowledge paths/retrieval, schedule registration/timezone/delivery,
  and approval enforcement before runtime use. Model authentication is separate from command-only
  integration secrets. Approval prose and token formats do not enforce approvals.
  Shared knowledge uses `../../FLEET-KNOWLEDGE.md` relative to a profile directory; verify the
  target runtime resolves that path as intended. No runtime compatibility is claimed by these tests.

## Development

```bash
node tools/build.mjs --check # embedded source consistency
node tests/validate.mjs     # structural checks, zero dependencies
node tests/generator.mjs    # behavioral generator/privacy/installer checks, zero dependencies
node tests/questionnaire.mjs # question coverage, context exports, recommendations and saved progress
node tests/no-network.mjs   # adversarial privacy proof, needs playwright
```

`generator.mjs` evaluates the real browser generators in Node, uses synthetic hostile strings,
and runs the installer only in a temporary home. It checks privacy tiers, unique paths, disabled
schedules, literal shell output, repeated backups, and JSON embedding. Shell checks report a skip
if no supported POSIX shell is available; Windows uses Git Bash. To run the optional browser test
against installed Chrome, set `PLAYWRIGHT_CHANNEL=chrome` (PowerShell:
`$env:PLAYWRIGHT_CHANNEL='chrome'`) before running it.

`validate.mjs` checks the content pack's structure and cross-references, the integrity of the
JSON embedded in the page, the YAML quoting rules, the absence of any external reference, and
that no secret-shaped strings are present.

The interview's copy, the agent roles, the model and tool catalogs, and the rules that derive a
fleet from your answers all live in `content/content-pack.json`. It is embedded verbatim into
`web/index.html` with JSON-safe escaping. Edit the pack, run `node tools/build.mjs`, then run the tests.

## Examples

- [`examples/solo-founder-fleet.md`](examples/solo-founder-fleet.md) — a bootstrapped SaaS
  founder with a family and a moderate budget
- [`examples/independent-trader-fleet.md`](examples/independent-trader-fleet.md) — a full-time
  trader whose hard red line is that no agent ever touches an order

## Related

- [hermes-agent](https://github.com/NousResearch/hermes-agent) — the agent framework this
  configures

## License

MIT
