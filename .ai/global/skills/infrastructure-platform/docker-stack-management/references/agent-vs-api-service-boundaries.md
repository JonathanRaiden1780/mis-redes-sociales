# When the user asks "aren't these services redundant?"

A stack accretes an API wrapper, an agent, a task-runner and a chat bot, and the
user eventually asks what each one is actually for. This is a design review
request disguised as a question, and the useful answer is often **"yes, partly —
here is what to switch off."**

## Answer honestly; do not defend the architecture

The instinct is to justify every service that exists. Resist it. If two
components genuinely overlap, saying so is the whole value of the reply. In this
stack, of four AI-ish services one was straightforwardly redundant and one was
absorbable — pretending otherwise would have left the user paying to run both.

Structure the answer as a verdict table, not prose:

| Service | What it *actually* does | Verdict |
|---|---|---|
| Agent | Reasons; has tools, memory, skills | keep |
| API wrapper | Stores data, serves fixed prompt modes | keep |
| Task-runner | Analyses projects — the agent does this better | absorbable |
| Chat bot | Duplicates the agent's own gateway, without tools | **switch off** |

Then give the command to remove the redundant one. A verdict without an action is
still homework for the user.

## The distinction that actually justifies keeping both

An agent and a thin API wrapper look like duplicates until you ask **who
consumes them**:

- The **agent decides**. Open-ended input, chooses which tools to call, carries
  memory between sessions. What a human drives.
- The **wrapper stores and serves**. Fixed routes, stable JSON, a database.
  What a *frontend* calls.

A React app cannot depend on an agent deciding today's response shape; it needs
`GET /api/reminders` to keep returning the same fields. That, and only that, is
why the wrapper survives. State the reason in those terms — "an app needs a
contract, an agent has judgement" — because it also tells the user when a future
service is justified.

Corollary for the redundant pieces: a **second messaging bot** in a stack that
already has an agent gateway is almost always waste. It duplicates the surface
with the weaker version, and on platforms like Telegram it additionally forces
two separate tokens (one `getUpdates` consumer per token).

## Agent memory has no clock — say so before they rely on it

This is the correction most worth carrying forward, because the failure is silent
and arrives weeks later.

Users conflate two different things when they say "will it remember?":

| | Agent memory | Scheduled reminder |
|---|---|---|
| Lives in | the agent's memory file | a database row with a `due_date` |
| Good for | *"the bill is bimonthly"* as a fact about the user | firing a notification on the day |
| Has a clock | **no** | yes, if something reads the table |

Telling an agent "remind me to pay the bill every two months" makes it *know*
that. It will **not** message you in two months. Nothing is scheduled, and the
user won't discover this until the reminder doesn't arrive.

So when a user asks whether the agent can remind them, answer in three parts:

1. It will remember the fact.
2. It will not wake up on its own.
3. Here is the missing piece — a scheduled job that reads due rows and sends the
   message.

If the agent has a cron/scheduling tool, that piece is one natural-language
instruction, not code:

> Create a daily job at 08:00 that queries
> `http://<wrapper>:<port>/api/reminders?days=1` and messages me if anything is
> due today.

## Bootstrap the agent's knowledge of its own stack

A freshly deployed agent knows nothing about the services running beside it. It
will answer from its own memory when it should be calling the API that persists
things. Fix it once, explicitly, in the agent's own memory:

> Save to memory: the wrapper is at `http://<service>:<port>` with reminders at
> `/api/reminders` and analysis at `/api/...`. When I ask you to remember
> something with a date, use that instead of your internal memory.

Then, once a flow works end to end, have the agent save it as a skill so the
routing isn't re-derived every session. Include both steps in the handover — an
agent that *can* reach the stack but doesn't know it exists looks broken.

## Deliver the recommendation as a target configuration

Close with the minimal set that satisfies the requirements, marked up:

```
✅ agent          ← the interface
✅ api wrapper    ← durable data + scheduled analysis
✅ dashboard      ← monitoring
❌ chat bot       ← switch off, duplicates the agent
⚠️ task runner    ← only while a scheduled job still calls it
```

Pair it with a numbered "what's missing" list ordered by consequence, so the user
knows the scheduler matters more than deleting a container.
