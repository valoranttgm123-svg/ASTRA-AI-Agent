# Main UI Performance Evidence

The main ASTRA page can expose an opt-in performance probe for the UI surfaces that are not measured by the Humanoid lab.

Open:

`http://127.0.0.1:3017/?perf=1`

The small `PERF UI` panel is rendered only when the query parameter is present. Normal ASTRA UI is unchanged.

## Scenarios

### MAIN IDLE

Click `MAIN IDLE` and leave ASTRA idle for the 10-second capture.

### COMMAND CENTER

Click `COMMAND CENTER`, then trigger a real ASTRA chat/request during the 10-second capture window.

The evidence records:

- whether the Brain activity panel exists;
- whether Brain streaming was observed;
- Brain event count before/after;
- orb states observed during capture.

The tool does not claim Command Center activity merely because the graph is visible. Review the activity fields before using the evidence.

### AUTOMATION PANEL

Open the real Automation panel first, then click `AUTOMATION PANEL`.

The capture refuses to start if `.astra-automation` is not actually open.

## Metrics

Each capture records:

- rAF frame intervals;
- average FPS;
- P50/P95/max frame time;
- slow-frame count;
- viewport/DPR;
- optional JS heap;
- long-task count/duration;
- window error count;
- unhandled rejection count;
- console error/warning counts;
- bounded runtime activity metadata.

It never persists prompt/response text, mic transcript, console message content, credentials or approval tokens.

## Storage

Evidence is sent to the same loopback ASTRA server and stored under:

`.astra/performance/ui-<scenario>-<timestamp>.json`

Every artifact remains:

`releaseVerdict = NOT_EVALUATED`

Use these artifacts together with the Humanoid HIGH captures when filling the real Phase 16 performance baseline.
