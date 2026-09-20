# Sonor UI Integration in ASTRA

Status: **Approved UI direction**

## Product decision

ASTRA is the primary everyday interface.

Sonor remains the advanced knowledge/workflow workspace.

Do **not** make the user operate two equal frontends for ordinary ASTRA tasks.

Do **not** permanently embed the full Sonor graph in the Humanoid home screen.

The desired experience is:

~~~text
ASTRA Humanoid / Command Center
        │
        ├─ focused knowledge context
        ├─ memory provenance
        ├─ project relationships
        └─ task-related mini graph
                 │
                 ▼
          Sonor knowledge backend
                 │
                 └─ Open Sonor Workspace
                     for full deep exploration
~~~

## Why

The full Sonor graph is information-dense and valuable for deep exploration, but it is too heavy and visually complex to become the permanent ASTRA main screen.

ASTRA should show only the information relevant to the current goal.

This protects:

- Humanoid smoothness;
- attention/focus;
- Command Center clarity;
- mobile/desktop usability.

## ASTRA primary layout

The normal ASTRA experience remains:

~~~text
┌─────────────────────────────────────────────────────────┐
│ ASTRA status / project / provider / Sonor status       │
├──────────────────────────────┬──────────────────────────┤
│                              │                          │
│         HUMANOID             │   COMMAND CENTER         │
│                              │   agents / plan / tools   │
│                              │                          │
├──────────────────────────────┴──────────────────────────┤
│ Chat / Voice / Task input                               │
└─────────────────────────────────────────────────────────┘
~~~

Sonor should appear as context, not as a replacement page.

## Sonor status indicator

Add a compact status chip in ASTRA:

- `SONOR • READY`
- `SONOR • INDEXING`
- `SONOR • OFFLINE`
- `SONOR • NOT CONFIGURED`
- `SONOR • ERROR`

The state must come from the real bridge/health endpoint.

No fake ONLINE status.

## Memory node behavior

Clicking the existing **Memory** node should open a **Memory Intelligence drawer/panel**.

Recommended sections:

### Overview

Show:

- current project;
- memory sources used;
- number of selected context records;
- last retrieval latency;
- privacy state;
- Sonor health.

### Sources

Chips/cards:

- Local Memory
- Project Files
- Sonor
- Graphify
- Obsidian
- GitHub
- Conversation context

Each source must show real state.

### Context Used

Show the bounded records actually selected for the current task.

Each record should display:

- source icon/type;
- project;
- short title/preview;
- relevance;
- timestamp if available;
- provenance/reference.

Do not display secrets or entire private documents by default.

### Relationships

Show a small **focused subgraph**, not the entire Sonor graph.

Typical limit:

- 10–30 relevant nodes;
- 1–2 relationship hops;
- current project/task centered.

Example:

~~~text
              Obsidian Note
                   │
GitHub PR ─── ALURKA TASK ─── Source File
                   │
              Codex Chat
                   │
               Decision
~~~

The focused graph is for understanding why context was selected.

### Open Sonor Workspace

Provide an explicit button:

`OPEN SONOR WORKSPACE ↗`

It opens the existing full Sonor UI for deep graph exploration.

Preferred desktop behavior:

- open in a dedicated ASTRA/Sonor window or external browser;
- reuse the existing `127.0.0.1:55127/#graph`;
- do not duplicate the graph renderer inside ASTRA.

## Command Center integration

When Sonor is queried, real lifecycle should appear in Command Center:

~~~text
Memory ACTIVE
   ↓
Sonor source queried
   ↓
Graphify matched
   ↓
Obsidian matched
   ↓
Context selected
   ↓
Memory READY
~~~

Use existing real events such as:

- `memory.search.started`
- `memory.source.queried`
- `memory.graph.matched`
- `memory.context.selected`
- `memory.search.completed`

Do not animate Sonor activity when no Sonor query occurred.

## Project context panel

When ASTRA resolves a project, show a compact project card:

- project name;
- aliases;
- current milestone;
- open tasks;
- connected repo(s);
- Sonor relationship count;
- last relevant activity.

Actions:

- `VIEW CONTEXT`
- `VIEW RELATIONSHIPS`
- `OPEN SONOR`

## Search interaction

The user should not need to manually search Sonor for ordinary tasks.

Example:

User:

`lanjutkan ALURKA terakhir`

ASTRA:

1. resolves ALURKA;
2. searches local/project memory;
3. queries Sonor;
4. selects relevant context;
5. shows source/provenance summary;
6. continues the task.

Sonor UI is optional unless the user wants deep inspection.

## Deep Sonor workspace

The existing Sonor screen remains the place for:

- full graph navigation;
- all projects;
- relationship exploration;
- indexing/debug status;
- Obsidian browsing;
- graph maintenance;
- advanced workflow analysis.

Do not remove these capabilities from Sonor merely because ASTRA can consume its data.

## Visual style

ASTRA's Sonor-derived panels should use ASTRA's visual language:

- near-black/navy background;
- cyan for active knowledge/memory;
- amber/orange for decisions/actions;
- muted slate for inactive/unconfigured sources;
- subtle node glow;
- no heavy full-screen blur over the animated Humanoid.

Do not copy the Sonor UI pixel-for-pixel into ASTRA.

The two products may share terminology and data, while ASTRA keeps its own visual identity.

## Performance rules

Never run the full Sonor graph renderer continuously behind the Humanoid.

Never import thousands of Sonor graph nodes into React state for ordinary task context.

Use:

- bounded API data;
- focused subgraph;
- lazy-loaded drawer;
- explicit full-workspace launch.

Target:

Humanoid FPS should remain effectively unchanged when the Memory panel is closed.

## Desktop final form

For the future ASTRA desktop app:

~~~text
ASTRA.exe
  ├─ Humanoid
  ├─ Command Center
  ├─ Memory Intelligence drawer
  ├─ focused Sonor subgraph
  └─ Open Sonor Workspace
          ↓
      dedicated window
          ↓
  http://127.0.0.1:55127/#graph
~~~

This preserves one coherent everyday experience while keeping Sonor's advanced workspace intact.

## UI Definition of Done

Sonor UI integration is complete when:

1. normal ASTRA use does not require opening Sonor manually;
2. Sonor connection status is truthful;
3. Memory node exposes actual sources/provenance;
4. the current task can show a small relevant relationship graph;
5. the full existing Sonor workspace remains available;
6. no duplicate graph database or Graphify/Obsidian pipeline exists;
7. Humanoid performance remains stable;
8. all displayed Sonor activity comes from real runtime events.
