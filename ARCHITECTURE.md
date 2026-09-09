# Architecture

## Shape

The app is a static GitHub Pages site:

- `index.html` - layout.
- `styles.css` - responsive interface and robot/world visuals.
- `levels.js` - level data.
- `app.js` - parser, interpreter, world engine, tracing, checks, UI rendering.

There is no backend and no build step.

## Execution model

Student code is parsed by a small educational parser. It does not execute arbitrary JavaScript or arbitrary Python. The parser supports only the syntax needed for the first lessons:

- function calls;
- assignment;
- `for i in range(...)`;
- `if/elif/else`;
- `def name():`;
- simple expressions.

The interpreter walks the AST and mutates the world state through controlled API functions. Every meaningful action emits a trace event:

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

This MVP intentionally avoids running general Python in the browser. The supported syntax is limited, and commands are mapped to safe educational actions. There is no file access, network access, imports, or arbitrary code execution.

The interpreter also has a maximum operation count to stop runaway loops.

## Checks

Each level can define checks:

- `reachGoal`;
- `minItems`;
- `expectedOutput`;
- `mustUse`;
- `tests` for hidden input/output tests.

For I/O levels, hidden tests catch hardcoded sample answers. For example, if the visible input is `5` and the learner writes `print(6)`, the visible example passes but hidden tests fail with a gentle message.

