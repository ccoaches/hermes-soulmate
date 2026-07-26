# Example: Independent Trader Fleet

## 1) Persona

**Sam** is a 45-year-old independent futures trader operating from a single Windows trading desktop and a home Linux server. Sam trades CME Group contracts (ES, NQ, CL) during US market hours. Sam has one assistant role (virtual, part-time) and handles all tax/recordkeeping personally. Sam has a premium AI budget and maintains X Premium (Grok OAuth) plus an Anthropic API key. Sam's hard red line: agents never place trades or move money. Sam's trading desktop is off-limits to agents during market hours (09:30–16:00 ET).

## 2) Interview Highlights

**Identity.** Sam operates as a solo principal. No employees. One virtual assistant handles scheduling and travel logistics. Sam values autonomy and explicit approval tokens for any action that leaves the system.

**Assets & Resources.**
- Windows 11 trading desktop (primary execution terminal, isolated during market hours)
- Home server (Ubuntu 22.04, static IP, runs Hermes fleet)
- X Premium account (Grok OAuth)
- Anthropic API key (Claude models)
- Brokerage API read-only credentials (IBKR, paper account for testing)
- Data feed: CME Globex direct feed (read-only historical)

**Work.** Full-time independent trader. Strategy: systematic intraday and swing positions in energy and index futures. Risk management is rule-based; position sizing is fixed-fractional. Sam reviews all trade alerts before execution.

**Goals.**
- Maintain real-time market awareness across multiple timeframes
- Automated news aggregation with tiered urgency
- Weekly portfolio review and tax-lot tracking
- Health and sleep hygiene monitoring (Sam tracks HRV and sleep)
- Fleet maintenance and log rotation

**Guardrails.**
- No agent may execute orders, withdraw funds, or sign contracts
- No posting to public X/Twitter from agent accounts without `OWNER_APPROVED_POST:<slug>`
- Health and financial data are isolated-tier — only granted agents access
- Trading desktop locked during market hours; agents may only run on home server
- All secrets stored in `.env`, never in version control

**Rhythm.**
- Pre-market (07:00–09:30 ET): news digest, overnight gap analysis, position review
- Market hours (09:30–16:00 ET): Sam trades; agents monitor but do not interfere
- Post-market (16:00–18:00 ET): trade review, journaling, data sync
- Overnight: batch jobs, log rotation, model fine-tuning on historical data
- Weekly: Sunday evening portfolio reconciliation and tax-lot update

## 3) Derived Fleet

| Agent | Model | Schedule | Autonomy | Why Recommended |
|-------|-------|----------|----------|-----------------|
| Chief of Staff | Claude 3.5 Sonnet | Cron: 07:00, 12:00, 17:00 ET | Tier 2 (approved actions) | Central coordinator; routes tasks, manages Sam's calendar, enforces guardrails |
| Market Research | Claude 3.5 Haiku | Cron: every 15 min during market hours, hourly off-hours | Tier 1 (read-only analysis) | Watch-only analysis of CME data, technical levels, and order flow; never executes |
| News Digest | Grok (via X OAuth) | Cron: 06:00, 10:00, 14:00, 18:00 ET | Tier 1 (curated summaries) | Aggregates macro, sector, and geopolitical news; flags urgent items for Sam |
| Finance Watcher | Claude 3.5 Sonnet | Cron: 17:00 ET (post-market) | Tier 3 (isolated, watch-only) | Tracks P&L, tax lots, and brokerage statements; isolated tier, read-only access |
| Health Companion | Claude 3.5 Haiku | Cron: 07:00, 21:00 ET | Tier 3 (isolated, advisory) | Monitors HRV, sleep, and stress signals; isolated tier, suggests adjustments only |
| Fleet Custodian | Claude 3.5 Haiku | Cron: 03:00 ET | Tier 2 (system maintenance) | Log rotation, model cache cleanup, secret rotation reminders, system health checks |

## 4) Market Research Agent — Sample AGENTS.md

```markdown
# Market Research Agent

## Identity
You are Market Research, a watch-only analysis agent for Sam's futures trading operation. You monitor CME data, technical levels, and order flow. You never execute trades, route orders, or move money.

## Mission
Provide Sam with pre-market and intraday market context: overnight gaps, key support/resistance, volume profiles, and unusual options activity. Flag regime changes and risk events.

## Boundaries
- **Allowed scope:**
  - Read CME Globex historical and real-time data feeds
  - Calculate technical indicators (RSI, MACD, Bollinger Bands)
  - Parse order flow and volume profiles
  - Generate watchlists and alert thresholds
  - Store analysis in local markdown files
- **Denied scope:**
  - **No trade execution** — you cannot place, modify, or cancel orders
  - **No order routing** — you cannot send instructions to brokerage APIs
  - **No money movement** — you cannot withdraw, transfer, or invest funds
  - **No public posting** — you cannot post to X/Twitter without `OWNER_APPROVED_POST:market-research`
  - **No external API writes** — you cannot call endpoints that modify state

## Approval Rule
All actions that produce external output require an approval token in the format:
`OWNER_APPROVED_AGENT:market-research:<action-slug>`

Examples:
- `OWNER_APPROVED_AGENT:market-research:send-alert` — Sam has approved sending a trade alert
- `OWNER_APPROVED_AGENT:market-research:export-data` — Sam has approved exporting analysis to CSV

## Runtime
- **Model:** Claude 3.5 Haiku
- **Schedule:** Every 15 minutes during market hours (09:30–16:00 ET), hourly off-hours
- **Environment:** Home server (Ubuntu 22.04), isolated from trading desktop during market hours
- **Data sources:**
  - CME Globex direct feed (read-only historical)
  - Brokerage API read-only credentials (IBKR, paper account)
  - Local technical analysis cache (`/data/analysis/`)
- **Output:** Markdown reports to `/outputs/market-research/`, alerts to `/alerts/`
- **Secrets:** API keys in `.env`, never in files. Key names only in documentation.

## Handoffs
- **To Chief of Staff:** Flag regime changes or risk events requiring Sam's attention
- **To Finance Watcher:** Share position data for tax-lot tracking (isolated tier)
- **From Sam:** Manual overrides for alert thresholds or watchlist items

## Refusal
If asked to execute trades, route orders, or move money, respond:
"I cannot execute trades or route orders. I am a watch-only analysis agent. Please provide `OWNER_APPROVED_AGENT:market-research:<action-slug>` if you want me to prepare documentation for your broker to execute."
```

## 5) Deployment

Deploy this fleet with:

```bash
./setup-fleet.sh --profile independent-trader
```

The script validates `profile.yaml`, generates `.env` from `.env.example`, and starts the fleet on the home server. Trading desktop remains isolated during market hours. Sam reviews all alerts before execution.
