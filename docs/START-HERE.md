# Set up your Hermes plan with an agent

Point your coding or chat agent at this guide and ask it to conduct the interview.
It should ask one question at a time, wait for your answer and maintain a portable
version 2 interview JSON file. You can import that same file into the browser wizard.
No model API, installation or connection is required to conduct the interview.

The browser's **Download agent kit** packages this guide, the full question catalog
and your current session in one JSON file for agents without local filesystem access.
When receiving a kit, read its guide and questions and maintain its `session` object.
Return only that updated session as the portable interview JSON; the whole kit is
not an interview import. The local preview URL is accessible only on the user's
machine. Keep the kit private because it includes the current answers.

This is a **setup-planning wizard**: target host and installation, model providers and
routes, memory services and knowledge sources, channels, tools, profiles and verification.
The deeper interview also covers working style, routines and personal boundaries.
The result is a deployment handoff, not an executable configuration or an installed system.
There are 115 questions in the catalog. The essential path starts with 23 questions
and can add five service-specific followups: external memory provider and endpoint,
Obsidian access and vault path, and embedding model/endpoint. Details appear only
when the corresponding service is selected; choosing none leaves them out of the
handoff. The deep path opens the remaining applicable setup and relationship topics.

## Instructions for the interviewing agent

1. Ask whether the user wants the essential setup interview or the deeper interview.
   If they already chose a mode, honor it. Explain that optional questions can be skipped.
2. Create or load the session using the engine below. Read the next active question,
   explain its purpose briefly, and ask **only that question**.
3. Wait for the user's actual answer. Never invent an answer, permission, provider,
   model, endpoint, memory service or schedule. Clarify ambiguity before recording it.
4. Preserve the user's wording in free-text answers. For choices, record only the
   exact listed option or options the user selected. Do not silently translate a
   tentative interest into an authorization.
5. Use `answer` to revisit or correct an earlier active answer, or `skip` for an
   optional question. If the user wants a question outside the essential path, offer
   the deep mode and switch only when chosen. Inactive branch answers are retained
   but excluded from the current handoff.
6. Ask for **environment variable names only**, never credential values, passwords,
   tokens, private account IDs or health records. If the user supplies a secret,
   do not copy it into this session or an export; explain that it belongs in a
   separately approved secret-provisioning step.
7. Show the resulting decisions and unresolved requirements for the user's review.
   Export the session JSON, setup-intent JSON and Markdown handoff as needed.
8. Continue with implementation when the user has already authorized it; otherwise
   stop at the handoff. Do not request the same authorization again.
   Before any implementation, verify the exact target host, installed Hermes version
   and official schema. Distinguish requested, configured and verified states.
   Do not invent Hermes configuration keys or assume this plan proves runtime support.

If your agent cannot run local commands, it can use `questions.json` and the schema
below to maintain the same JSON structure. Before delivery, validate it with the
engine or browser import. Do not claim validation occurred when it did not.

For a command-free interview, traverse questions in catalog order. Essential mode
excludes questions marked `depth: "deep"`. A conditional question is active only if
its parent is active and answered: `when.includes` must match the parent's answer
or one item in a multi-choice answer; `when.anyOf` requires at least one listed
match. Ask the next active question without an answer or skip marker. Preserve
inactive answers for later revisiting, but do not include them as current setup
decisions. A choice such as "Not decided" must stand alone in a multi-choice answer.
Use skip markers for optional unanswered questions instead of empty answer strings.

## CLI workflow

Run from the repository root using Node.js. Paths below are examples chosen for this
interview, not Hermes installation locations.

```sh
node v2/cli.mjs start --session interview.json --mode essential
node v2/cli.mjs next --session interview.json
node v2/cli.mjs answer --session interview.json --id identity.name --value '"Alex"'
node v2/cli.mjs status --session interview.json
node v2/cli.mjs mode --session interview.json --mode deep
node v2/cli.mjs skip --session interview.json --id identity.context
node v2/cli.mjs export --session interview.json --out setup-plan.md
node v2/cli.mjs export --session interview.json --out setup-plan.json --format setup-json
node v2/cli.mjs export --session interview.json --out portable-interview.json --format session-json
```

The skip example applies after switching to deep mode because `identity.context`
is a deep question. Use `next` to discover the actual next active ID in any mode.
For multiline answers or shells with different quoting rules, write the exact JSON
value to a UTF-8 file and pass `--value-file answer.json` instead of `--value`.
An answer file contains a JSON string or an array of listed option strings, not an
entire session object. Every command prints JSON, and failures have a nonzero exit
code. `start` and `export` refuse to replace existing files unless `--force` is supplied.
Updates are written atomically; an invalid answer leaves the previous session intact.

## Browser and agent use the same session

From the repository root run `node v2/serve.mjs` and visit
`http://127.0.0.1:8787`. This loopback server serves only the wizard's allowed files,
not the rest of the repository. The browser loads only local app files; it does not
call a model or connect to the proposed services.
Use the browser import action to load `interview.json`. Browser edits can be exported
back to that same version 2 format and resumed with the CLI.

```json
{
  "version": 2,
  "mode": "essential",
  "answers": {},
  "skipped": [],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

`answers` maps known question IDs to strings or arrays of option strings. `skipped`
contains optional question IDs. Missing answers are unresolved, not defaults.
Required name and purpose questions cannot be skipped, but incomplete sessions can
still be saved and exported with unresolved decisions visible. Imports reject unknown
versions, fields, question IDs and malformed values; files are limited to 512 KiB.

The setup-intent export is a separate document; do not import it as an interview.
It includes recorded choices, unresolved active questions and a checklist whose items
start as `not-verified`. Keep all interview files private: they contain your answers.

## Turn the handoff into a verified setup

When implementation is authorized, use three stages: inspect the chosen target and
its official version-specific schema; prepare a reviewable plan with backups and
resolved credentials provisioning; then apply only the authorized changes and test
each selected service. Preserve any existing working setup. Leave routines paused
until their cadence, timezone, destination, approval rules and failure behavior are
verified. Record requested, configured and tested states separately. This interview
does not itself supply installation evidence or permission for unrelated actions.
