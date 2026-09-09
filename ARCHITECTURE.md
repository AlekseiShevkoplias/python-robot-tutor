# Architecture

## Shape

The app is a static GitHub Pages site:

- `index.html` - layout.
- `styles.css` - responsive interface and robot/world visuals.
- `levels.js` - level data.
- `app.js` - parser, interpreter, world engine, tracing, checks, UI rendering.

There is no backend and no build step. Python runs in the browser through Pyodide.

## Execution model

Student code is executed by a real Pyodide Python runtime. The app injects a hidden educational `robot` module and also exposes its most common commands directly as globals:

- `go`;
- `turn_left`;
- `turn_right`;
- `front_is_clear`;
- `at_goal`;
- `pick`;
- `read_number`;
- `say`.

The Python runner uses `sys.settrace` to record source-line events from the student program. The hidden robot API mutates world state and emits action trace events:

```json
{
  "line": 3,
  "message": "Робот сделал шаг в клетку (2, 1).",
  "kind": "move",
  "snapshot": {}
}
```

The UI playback uses these snapshots for Run and Step.

## Sandboxing

The app runs in the browser and has no backend. This means student code cannot affect the server or the tutor's machine, but Pyodide is a real Python runtime and should not be treated as a strong security sandbox.

The runner adds a maximum traced-line count to stop runaway loops. The robot API is controlled, and output is captured into the UI.

## Checks

Each level can define checks:

- `reachGoal`;
- `minItems`;
- `expectedOutput`;
- `mustUse`;
- `tests` for hidden input/output tests.

For I/O levels, hidden tests catch hardcoded sample answers. For example, if the visible input is `5` and the learner writes `print(6)`, the visible example passes but hidden tests fail with a gentle message.

## Level Families

Newer levels can define `cases`. A case is a concrete input world inside a broader contract:

```js
{
  kind: "edge",
  label: "goal at start",
  world: corridorWorld(0),
  inputQueue: [],
  checks: { reachGoal: true }
}
```

The UI materializes `currentLevel + selectedCase` into an active runnable level. `Run` and `Step` use the selected case. `Run all` executes the same student code across all cases and stores the first failing case as a counterexample. `Replay fail` switches the world to that failing case so the learner can step through it.

This makes the teaching model:

```text
Level = specification + input family + tests
```

instead of:

```text
Level = one map
```
