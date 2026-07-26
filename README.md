# Hermes SoulMate

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
- **Sensitivity tiers.** Health, family and money default to `isolated` — that data appears only
  in the `USER.md` of agents you explicitly grant that tier. Isolation is for protection, not exclusion.
- **Fail-closed guardrails.** Moving money, posting publicly, emailing real people, deleting
  files, and touching off-limits machines are denied by default in every generated `AGENTS.md`.
  You have to deliberately opt out of each red line.
- **The installer is conservative.** It backs up any existing profile directory to
  `<dir>.bak.$(date +%s)` before writing, and it never writes a real `.env` — only `.env.example`.
- **Read the script.** `setup-fleet.sh` is plain POSIX shell with quoted heredocs. It is meant
  to be read before it is run.

## Development

```bash
node tests/validate.mjs     # structural checks, zero dependencies
node tests/no-network.mjs   # adversarial privacy proof, needs playwright
```

`validate.mjs` checks the content pack's structure and cross-references, the integrity of the
JSON embedded in the page, the YAML quoting rules, the absence of any external reference, and
that no secret-shaped strings are present.

The interview's copy, the agent roles, the model and tool catalogs, and the rules that derive a
fleet from your answers all live in `content/content-pack.json`. It is embedded verbatim into
`web/index.html`. Edit the pack, re-embed it, run the tests.

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
