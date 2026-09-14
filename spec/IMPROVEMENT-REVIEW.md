# SoulMate questionnaire and generator review

Repository: `ccoaches/hermes-soulmate` only.
Baseline: `ae1e31f0a28b851f6b342eb266b02a094dd42c94`.

## Questionnaire expansion

The interview now contains 106 optional top-level questions, up from 70, across 14 steps. Four new sections cover Projects & Workflows, Content & Audience, Health & Wellbeing, and Family & Lifestyle. Existing sections gained values, decision preferences, accessibility preferences, business priorities, near-term goals, trusted-source and memory preferences, urgent alerts, and check-in preferences. Goal and social-account repeaters gained eight additional subfields.

Non-empty answers are formatted with their question labels into eligible profiles' USER.md files. The same privacy and skip rules apply to the new sections. Existing saved answers, custom fleets, and progress survive the expanded step order. Repeaters support multiple entries and remain usable on narrow screens.

Questionnaire verification: 87 distinct field/subfield markers passed export/privacy/skip checks; all ten legacy progress positions passed migration checks. Real Chrome tests entered answers, added and removed rows, reloaded saved progress, and verified those answers in the downloaded installer. Desktop and 390-pixel mobile layouts were inspected. Independent code review approved the expansion.

## Confirmed baseline defects

- Duplicate display names produce colliding profile paths and ZIP entries; installation replaces an earlier profile with a later one.
- SOUL goals and work constraints bypass USER privacy filtering; professional contacts are gated by the wrong section, and machine lists bypass filtering.
- The installer omits shared fleet files, uses collision-prone backups, and inserts freeform data into shell comments/status output and predictable heredocs.
- Model and multiline values can corrupt generated YAML.
- The build emits an invalid JSON escape for HTML-comment text.
- Integration-secret templates do not consistently match command-only ownership.
- Generated schedules appear enabled before runtime setup, and setup wording overstates readiness.
- The browser test uses a fixed navigation count rather than verifying the download page and an actual download.

## Acceptance

Run the real generators with synthetic data and test duplicate names, privacy boundaries, hostile text, deterministic export, ZIP uniqueness, and generated installer behavior in a temporary home. Verify the browser can complete the interview and download without external requests. Test installer reruns preserve existing data. Inspect all changes independently.

Commands:

```sh
node tools/build.mjs --check
node tests/validate.mjs
node tests/generator.mjs
node tests/questionnaire.mjs
node tests/questionnaire-browser.mjs
node tests/no-network.mjs
git diff --check
```

The browser check requires Playwright and a browser; `PLAYWRIGHT_CHANNEL=chrome` selects an existing Chrome installation. These are development tools, not runtime dependencies of the app.

## Verified result

- Build consistency: passed.
- Structural and publish checks: 18/18 passed, including all 17 tracked paths.
- Behavioral generator checks: six groups passed, including nine privacy combinations, explicit mission preservation, duplicate paths, hostile text, disabled schedules, JSON embedding, and repeated shell installation in an isolated temporary home.
- Browser checks: 11 passed using Chrome. The interview reached Review and downloaded an installer; normal use attempted zero external requests. Deliberate exfiltration probes were blocked by the browser policy.
- Independent YAML parsing: three generated documents parsed successfully; a hostile multiline model remained one scalar value.
- Whitespace check: passed.
- Independent final code review: approved with no remaining confirmed blocker in the generator hardening scope.

The original personal export was not rewritten. Regenerate it using the repaired page after reviewing the selected names, missions, and privacy tiers. Work information now has a privacy selector; inspect that setting when reopening previously saved answers. Older saved custom missions have no edit-provenance flag: re-enter them on the Fleet step if they should override a role's derived mission.

## Remaining product work

This change is generator hardening. Runtime connectivity is a separate milestone:

1. Validate generated settings against an explicitly selected Hermes version.
2. Verify provider authentication and model availability rather than equating a subscription with automation access.
3. Configure and test real tool connections and knowledge retrieval.
4. Register schedules with an explicit timezone and delivery destination; verify a delivered result.
5. Enforce approvals at execution time and bind them to the exact action.
6. Replace broad privacy tiers with explicit per-agent grants where users need finer control.

No live fleet installation, service mutation, repository publication, or website deployment is part of this review.
