# Research behind the Hermes setup wizard

The wizard translates community workflows into explicit setup decisions. Community posts are inspiration, not proof of installed capabilities or promised results. Runtime configuration must be checked against the target Hermes version.

## What shaped the interview

| Source | Setup decisions it informs |
| --- | --- |
| [Hermes masterclass roadmap](https://x.com/tonysimons_/status/2079066422211117218) | Host and deployment, memory, skills, tools, schedules, messaging, delegation, browser access, Kanban and separate profiles. |
| [Token spending](https://x.com/tonysimons_/status/2098097570929418501) | Main and auxiliary models, local inference, explicit fallback costs, context discipline, tool scope and script-only recurring work. |
| [Auxiliary model example](https://x.com/HermesAgentTips/status/2099174576554934385) | Separate routine helper work from deeper review; ask for exact user-selected models rather than copying an author's choices. |
| [Model routing](https://x.com/rlaope/status/2098966653497438403) | Assign models by job and collect limits; the author's speed/cost claims are not benchmarks for this wizard. |
| [Layered memory](https://x.com/rlaope/status/2081947109113385261) | Distinguish stable identity, bounded persistent memory, source documents and searchable history; specify who may write. |
| [Knowledge workspace](https://x.com/N01ennn/status/2067226698265899199) | Keep a knowledge vault distinct from runtime memory and expose the target location. |
| [Shared family use](https://x.com/didier_lopes/status/2098845600435327439) | Shared versus private context, household participants and permitted actions. |
| [Home Assistant](https://x.com/HermesWatcher/status/2095682012120224129) | Selected devices/events, connection requirements and action boundaries. |
| [Composio integration](https://x.com/tonysimons_/status/2080093855618093364) | Selected apps, account ownership, OAuth and allowed tools. Selecting an integration does not authenticate it. |
| [Real-profile browsing](https://x.com/NousResearch/status/2093063359587348487) | Browser profile choice and account scope. |
| [Bot Mode](https://x.com/tonbistudio/status/2089583590028009610) | Named specialists with separate roles, models, memory and skills. |
| [Bot communication](https://x.com/tonysimons_/status/2091048109174628830) | Team roster, routing and explicit handoff responsibilities. |
| [Separation of duties](https://x.com/witcheer/status/2090363631707762795) | Distinct research, implementation and verification responsibilities. |
| [Kanban](https://x.com/tonysimons_/status/2066976508338385041) | Work queues, project boundaries, completion evidence and stalled-worker recovery. |
| [Recurring-task audit](https://x.com/trevin/status/2092011026242027644) | Purpose, cadence, delivery, cost, failures, change detection and retirement criteria. |
| [Personal briefing](https://x.com/BkashJosi/status/2097980995735785752) | Briefing content, format, destination and archive. |
| [Backup](https://x.com/witcheer/status/2081051573254549904) | Backup ownership, protected destinations and restoration verification before changes. |
| [Session maintenance](https://x.com/HermesWatcher/status/2092643274205037025) | Preserve history; distinguish optimization, deliberate pruning and repair. |
| [WhatsApp](https://x.com/NousResearch/status/2065466908103598253) | Private/team/customer-facing channel identity and access controls. |
| [Creative video](https://x.com/IBuzovskyi/status/2066724948702626255) | Media formats, tools, dependencies, output location and human review. |
| [Creative ideation](https://x.com/iamlukethedev/status/2069859725189988419) | Real constraints and useful deliverables rather than generic brainstorming. |
| [Agent administration](https://x.com/HermesWatcher/status/2080841007604924782) | A clear owner for models, profiles, updates and troubleshooting. |

## Official configuration references

- [Setup](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart) and [configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration): use the installed version's setup, model picker, doctor and configuration checks. A successful config check is not proof of a working model call.
- [Models](https://hermes-agent.nousresearch.com/docs/user-guide/configuring-models) and [fallbacks](https://hermes-agent.nousresearch.com/docs/user-guide/features/fallback-providers/): provider/model/endpoint/API choices, auxiliary routes and explicitly permitted fallbacks. No prices or model availability are frozen in the wizard.
- [Built-in memory](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/memory.md): `memories/USER.md` and `memories/MEMORY.md` belong to the selected Hermes home and have limits.
- [External memory providers](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers): one active external provider. Choices include Honcho, OpenViking, Mem0, Hindsight, Holographic, RetainDB, ByteRover and Supermemory; verify availability in the target version.
- [Obsidian skill](https://github.com/NousResearch/hermes-agent/blob/main/skills/note-taking/obsidian/SKILL.md): Obsidian uses a vault path and filesystem permissions; it is distinct from an external memory provider.
- [MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp), [profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles), [messaging](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/) and [schedules](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron): collect exact targets, authentication requirements, scopes and verification steps. New schedules should be staged paused until their intended activation is established.

## Coverage and limits

Research read the full post-page text of 49 selected public X posts, including quoted previews, plus the linked masterclass roadmap and token-spending article. The original private collection membership is not published here. Embedded videos were not transcribed, image-only instructions were not treated as verified setup instructions, and not every outbound article/repository was recursively reviewed. Grok-specific trading and revenue claims were treated as examples of role separation, never as Hermes capability or performance evidence. The wizard does not promise earnings, install every mentioned third-party package, or convert a bookmark into permission to act.

These are research references, not network dependencies: the wizard does not load them during an interview.
