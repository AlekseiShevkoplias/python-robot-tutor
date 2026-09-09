"use strict";

const DIRS = ["N", "E", "S", "W"];
const DELTAS = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 }
};

const els = {
  levelSelect: document.querySelector("#levelSelect"),
  levelConcept: document.querySelector("#levelConcept"),
  levelTitle: document.querySelector("#levelTitle"),
  levelDescription: document.querySelector("#levelDescription"),
  levelGoal: document.querySelector("#levelGoal"),
  codeEditor: document.querySelector("#codeEditor"),
  codeLines: document.querySelector("#codeLines"),
  runButton: document.querySelector("#runButton"),
  stepButton: document.querySelector("#stepButton"),
  resetButton: document.querySelector("#resetButton"),
  starterButton: document.querySelector("#starterButton"),
  grid: document.querySelector("#grid"),
  statusBanner: document.querySelector("#statusBanner"),
  robotState: document.querySelector("#robotState"),
  variablesPanel: document.querySelector("#variablesPanel"),
  inputPanel: document.querySelector("#inputPanel"),
  outputPanel: document.querySelector("#outputPanel"),
  tracePanel: document.querySelector("#tracePanel")
};

let currentLevel = window.ROBOT_LEVELS[0];
let currentState = null;
let lastRun = null;
let playbackIndex = -1;
let pyodideReadyPromise = null;
let pyodideRuntime = null;

const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/";
const PYTHON_ENGINE_SOURCE = `
import builtins
import json
import math
import random
import sys
import traceback
import types

DIRS = ["N", "E", "S", "W"]
DELTAS = {
    "N": {"x": 0, "y": -1},
    "E": {"x": 1, "y": 0},
    "S": {"x": 0, "y": 1},
    "W": {"x": -1, "y": 0},
}

class RobotError(Exception):
    def __init__(self, message, line=None):
        super().__init__(message)
        self.line = line

def _safe_value(value, depth=0):
    if depth > 2:
        return "..."
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (list, tuple)):
        return [_safe_value(item, depth + 1) for item in value[:20]]
    if isinstance(value, dict):
        return {str(key): _safe_value(item, depth + 1) for key, item in list(value.items())[:20]}
    return repr(value)

def _run_robot_program(source, level_json, input_override_json=None, silent=False):
    level = json.loads(level_json)
    input_queue = json.loads(input_override_json) if input_override_json else list(level.get("inputQueue") or [])
    world = level["world"]
    state = {
        "robot": {
            "x": world["start"]["x"],
            "y": world["start"]["y"],
            "dir": world["start"]["dir"],
            "inventory": [],
        },
        "items": json.loads(json.dumps(world.get("items") or [])),
        "variables": {},
        "output": [],
        "inputQueue": input_queue,
        "inputUsed": 0,
        "error": None,
        "success": False,
    }
    events = []
    op_count = 0
    max_ops = 1200
    api_names = {
        "go", "turn_left", "turn_right", "turn", "pick", "say", "print",
        "front_is_clear", "right_is_clear", "left_is_clear", "at_goal", "on_item",
        "read_number", "read_text",
    }

    def public_vars(frame=None):
        raw = {}
        if frame is not None:
            raw.update(frame.f_globals)
            raw.update(frame.f_locals)
        visible = {}
        hidden = set(api_names) | {
            "__builtins__", "math", "random", "robot", "range", "len", "int", "str", "bool",
            "_record", "_snapshot", "_safe_value"
        }
        for name, value in raw.items():
            if name.startswith("__") or name in hidden:
                continue
            if isinstance(value, types.ModuleType) or callable(value):
                continue
            visible[name] = _safe_value(value)
        return visible

    def snapshot(frame=None):
        copied = json.loads(json.dumps(state))
        copied["variables"] = public_vars(frame)
        return copied

    def record(line, message, kind="step", frame=None):
        state["variables"] = public_vars(frame)
        if not silent:
            events.append({"line": line, "message": message, "kind": kind, "snapshot": snapshot(frame)})

    def cell_key(pos):
        return f"{pos['x']},{pos['y']}"

    def is_wall(x, y):
        if x < 0 or y < 0 or x >= world["width"] or y >= world["height"]:
            return True
        return any(wall["x"] == x and wall["y"] == y for wall in world.get("walls") or [])

    def next_cell():
        delta = DELTAS[state["robot"]["dir"]]
        return {"x": state["robot"]["x"] + delta["x"], "y": state["robot"]["y"] + delta["y"]}

    def caller_line():
        try:
            return sys._getframe(2).f_lineno
        except Exception:
            return None

    def go(n=1):
        line = caller_line()
        if not isinstance(n, int) or n < 0:
            raise RobotError("go(n) ждет целое число шагов: например go(3).", line)
        record(line, f"go({n})")
        for _ in range(n):
            nxt = next_cell()
            if is_wall(nxt["x"], nxt["y"]):
                raise RobotError("Робот попытался пойти в стену. Проверь маршрут перед этой строкой.", line)
            state["robot"]["x"] = nxt["x"]
            state["robot"]["y"] = nxt["y"]
            record(line, f"Робот сделал шаг в клетку ({nxt['x']}, {nxt['y']}).", "move")

    def _turn_amount(amount, line=None):
        if line is None:
            line = caller_line()
        if amount not in (90, -90, 180, -180):
            raise RobotError("turn(angle) поддерживает 90, -90 и 180.", line)
        idx = DIRS.index(state["robot"]["dir"])
        state["robot"]["dir"] = DIRS[(idx + amount // 90 + 400) % 4]
        record(line, f"Робот повернул. Теперь направление: {state['robot']['dir']}.", "turn")

    def turn_right():
        _turn_amount(90, caller_line())

    def turn_left():
        _turn_amount(-90, caller_line())

    def turn(angle):
        _turn_amount(angle, caller_line())

    def _clear_for(direction):
        dir_name = state["robot"]["dir"]
        if direction == "right":
            dir_name = DIRS[(DIRS.index(dir_name) + 1) % 4]
        elif direction == "left":
            dir_name = DIRS[(DIRS.index(dir_name) + 3) % 4]
        delta = DELTAS[dir_name]
        x = state["robot"]["x"] + delta["x"]
        y = state["robot"]["y"] + delta["y"]
        return not is_wall(x, y)

    def front_is_clear():
        return _clear_for("front")

    def right_is_clear():
        return _clear_for("right")

    def left_is_clear():
        return _clear_for("left")

    def at_goal():
        goal = world.get("goal")
        return bool(goal and state["robot"]["x"] == goal["x"] and state["robot"]["y"] == goal["y"])

    def on_item():
        return any(item["x"] == state["robot"]["x"] and item["y"] == state["robot"]["y"] for item in state["items"])

    def pick():
        line = caller_line()
        for index, item in enumerate(state["items"]):
            if item["x"] == state["robot"]["x"] and item["y"] == state["robot"]["y"]:
                state["items"].pop(index)
                state["robot"]["inventory"].append(item.get("name") or "предмет")
                record(line, f"Робот поднял: {item.get('name') or 'предмет'}.", "item")
                return
        raise RobotError("Здесь нет предмета. pick() работает только на клетке с предметом.", line)

    def read_number():
        line = caller_line()
        if state["inputUsed"] >= len(state["inputQueue"]):
            raise RobotError("Программа пытается прочитать число, но во входе больше ничего нет.", line)
        value = state["inputQueue"][state["inputUsed"]]
        state["inputUsed"] += 1
        try:
            number = int(value)
        except Exception:
            raise RobotError(f"Ожидалось число, но во вводе лежит {value!r}.", line)
        record(line, f"read_number() взял {number}")
        return number

    def read_text():
        line = caller_line()
        if state["inputUsed"] >= len(state["inputQueue"]):
            raise RobotError("Программа пытается прочитать текст, но во входе больше ничего нет.", line)
        value = str(state["inputQueue"][state["inputUsed"]])
        state["inputUsed"] += 1
        record(line, f"read_text() взял {value!r}")
        return value

    def say(*values):
        line = caller_line()
        text = " ".join(str(value) for value in values)
        state["output"].append(text)
        record(line, f"say: {text}", "output")

    def print_(*values, sep=" ", end="\\n"):
        line = caller_line()
        text = sep.join(str(value) for value in values)
        if end and end != "\\n":
            text += end
        state["output"].append(text)
        record(line, f"print: {text}", "output")

    robot = types.ModuleType("robot")
    env = {
        "go": go,
        "turn_left": turn_left,
        "turn_right": turn_right,
        "turn": turn,
        "front_is_clear": front_is_clear,
        "right_is_clear": right_is_clear,
        "left_is_clear": left_is_clear,
        "at_goal": at_goal,
        "on_item": on_item,
        "pick": pick,
        "read_number": read_number,
        "read_text": read_text,
        "say": say,
        "print": print_,
        "math": math,
        "random": random,
        "range": range,
        "len": len,
        "int": int,
        "str": str,
        "bool": bool,
    }
    for name, value in env.items():
        setattr(robot, name, value)
    sys.modules["robot"] = robot

    allowed_builtins = dict(vars(builtins))
    allowed_builtins["print"] = print_
    env["__builtins__"] = allowed_builtins

    def trace_func(frame, event, arg):
        nonlocal op_count
        if frame.f_code.co_filename != "<student>":
            return trace_func
        if event == "line":
            op_count += 1
            if op_count > max_ops:
                raise RobotError("Программа сделала слишком много шагов. Возможно, цикл повторяется слишком долго.", frame.f_lineno)
            record(frame.f_lineno, "Выполняется строка.", "line", frame)
        return trace_func

    try:
        compiled = compile(source, "<student>", "exec")
        old_trace = sys.gettrace()
        sys.settrace(trace_func)
        try:
            exec(compiled, env, env)
        finally:
            sys.settrace(old_trace)
        state["variables"] = public_vars(types.SimpleNamespace(f_globals=env, f_locals=env))
        if not silent:
            events.append({"line": None, "message": "Программа закончилась.", "kind": "done", "snapshot": snapshot(types.SimpleNamespace(f_globals=env, f_locals=env))})
    except SyntaxError as error:
        state["error"] = {
            "message": f"Python не понял синтаксис на строке {error.lineno}. Проверь скобки, двоеточие и отступы.",
            "line": error.lineno,
            "raw": "".join(traceback.format_exception_only(type(error), error)).strip(),
        }
        if not silent:
            events.append({"line": error.lineno, "message": state["error"]["message"], "kind": "error", "snapshot": snapshot()})
    except RobotError as error:
        state["error"] = {"message": str(error), "line": error.line, "raw": str(error)}
        if not silent:
            events.append({"line": error.line, "message": str(error), "kind": "error", "snapshot": snapshot()})
    except NameError as error:
        line = None
        tb = traceback.extract_tb(error.__traceback__)
        for item in reversed(tb):
            if item.filename == "<student>":
                line = item.lineno
                break
        state["error"] = {
            "message": f"Python не знает это имя. Возможно, опечатка в переменной или команде: {error}",
            "line": line,
            "raw": "".join(traceback.format_exception_only(type(error), error)).strip(),
        }
        if not silent:
            events.append({"line": line, "message": state["error"]["message"], "kind": "error", "snapshot": snapshot()})
    except Exception as error:
        line = None
        tb = traceback.extract_tb(error.__traceback__)
        for item in reversed(tb):
            if item.filename == "<student>":
                line = item.lineno
                break
        state["error"] = {
            "message": f"Python остановился на ошибке: {error}",
            "line": line,
            "raw": "".join(traceback.format_exception_only(type(error), error)).strip(),
        }
        if not silent:
            events.append({"line": line, "message": state["error"]["message"], "kind": "error", "snapshot": snapshot()})

    return json.dumps({"state": state, "events": events}, ensure_ascii=False)
`;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInitialState(level, inputQueueOverride) {
  const inputQueue = inputQueueOverride ? [...inputQueueOverride] : [...(level.inputQueue || [])];
  return {
    robot: {
      x: level.world.start.x,
      y: level.world.start.y,
      dir: level.world.start.dir,
      inventory: []
    },
    items: clone(level.world.items || []),
    variables: {},
    output: [],
    inputQueue,
    inputUsed: 0,
    error: null,
    success: false
  };
}

function setExecutionControlsDisabled(disabled) {
  els.runButton.disabled = disabled;
  els.stepButton.disabled = disabled;
}

async function initPyodideEngine() {
  setExecutionControlsDisabled(true);
  setBanner("Загружаю настоящий Python в браузере...");
  if (typeof loadPyodide !== "function") {
    setExecutionControlsDisabled(false);
    setBanner("Pyodide не загрузился. Проверь интернет и обнови страницу.", "error");
    return null;
  }
  try {
    pyodideRuntime = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
    pyodideRuntime.runPython(PYTHON_ENGINE_SOURCE);
    setExecutionControlsDisabled(false);
    setBanner("Python готов. Перед запуском попробуй предсказать результат.");
    return pyodideRuntime;
  } catch (error) {
    setExecutionControlsDisabled(false);
    setBanner("Не получилось загрузить Python. Попробуй обновить страницу.", "error");
    console.error(error);
    return null;
  }
}

function snapshot(state) {
  return clone(state);
}

function cellKey(pos) {
  return `${pos.x},${pos.y}`;
}

function isWall(level, x, y) {
  if (x < 0 || y < 0 || x >= level.world.width || y >= level.world.height) return true;
  return (level.world.walls || []).some((wall) => wall.x === x && wall.y === y);
}

function nextCell(robot) {
  const delta = DELTAS[robot.dir];
  return { x: robot.x + delta.x, y: robot.y + delta.y };
}

function turn(robot, amount) {
  const current = DIRS.indexOf(robot.dir);
  const steps = amount / 90;
  const next = (current + steps + 400) % 4;
  robot.dir = DIRS[next];
}

class FriendlyError extends Error {
  constructor(message, line = null, raw = null) {
    super(message);
    this.line = line;
    this.raw = raw || message;
  }
}

function preprocess(code) {
  return code.replace(/\t/g, "    ").split(/\r?\n/).map((text, index) => ({
    text,
    trimmed: text.trim(),
    indent: text.match(/^ */)[0].length,
    line: index + 1
  }));
}

function parseProgram(code) {
  const lines = preprocess(code);
  const result = parseBlock(lines, 0, 0);
  const trailing = nextMeaningful(lines, result.index);
  if (trailing < lines.length) {
    throw new FriendlyError("Проверь отступ: эта строка стоит глубже, чем ожидает Python.", lines[trailing].line);
  }
  return result.nodes;
}

function nextMeaningful(lines, index) {
  let i = index;
  while (i < lines.length && (lines[i].trimmed === "" || lines[i].trimmed.startsWith("#"))) i += 1;
  return i;
}

function parseBlock(lines, startIndex, indent) {
  const nodes = [];
  let index = startIndex;

  while (index < lines.length) {
    index = nextMeaningful(lines, index);
    if (index >= lines.length) break;

    const line = lines[index];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      throw new FriendlyError("Похоже, здесь лишний отступ. Python очень внимательно смотрит на пробелы слева.", line.line);
    }
    if (line.trimmed.startsWith("elif ") || line.trimmed === "else:") break;

    if (/^def\s+/.test(line.trimmed)) {
      const match = line.trimmed.match(/^def\s+([A-Za-z_]\w*)\s*\(\s*\)\s*:\s*$/);
      if (!match) {
        throw new FriendlyError("Функция должна выглядеть так: def name():", line.line);
      }
      const bodyResult = parseRequiredBody(lines, index + 1, indent, line.line);
      nodes.push({ type: "def", name: match[1], body: bodyResult.nodes, line: line.line });
      index = bodyResult.index;
      continue;
    }

    if (/^for\s+/.test(line.trimmed)) {
      const match = line.trimmed.match(/^for\s+([A-Za-z_]\w*)\s+in\s+range\s*\((.*)\)\s*:\s*$/);
      if (!match) {
        throw new FriendlyError("Цикл должен выглядеть так: for i in range(4):", line.line);
      }
      const bodyResult = parseRequiredBody(lines, index + 1, indent, line.line);
      nodes.push({ type: "for", varName: match[1], rangeExpr: match[2], body: bodyResult.nodes, line: line.line });
      index = bodyResult.index;
      continue;
    }

    if (/^if\s+/.test(line.trimmed)) {
      const ifMatch = line.trimmed.match(/^if\s+(.+)\s*:\s*$/);
      if (!ifMatch) {
        throw new FriendlyError("Условие должно заканчиваться двоеточием: if front_is_clear():", line.line);
      }
      const branches = [];
      let bodyResult = parseRequiredBody(lines, index + 1, indent, line.line);
      branches.push({ kind: "if", condition: ifMatch[1], body: bodyResult.nodes, line: line.line });
      index = bodyResult.index;

      while (true) {
        index = nextMeaningful(lines, index);
        if (index >= lines.length || lines[index].indent !== indent) break;
        const branchLine = lines[index];
        if (branchLine.trimmed.startsWith("elif ")) {
          const elifMatch = branchLine.trimmed.match(/^elif\s+(.+)\s*:\s*$/);
          if (!elifMatch) throw new FriendlyError("elif тоже должен заканчиваться двоеточием.", branchLine.line);
          bodyResult = parseRequiredBody(lines, index + 1, indent, branchLine.line);
          branches.push({ kind: "elif", condition: elifMatch[1], body: bodyResult.nodes, line: branchLine.line });
          index = bodyResult.index;
          continue;
        }
        if (branchLine.trimmed === "else:") {
          bodyResult = parseRequiredBody(lines, index + 1, indent, branchLine.line);
          branches.push({ kind: "else", condition: null, body: bodyResult.nodes, line: branchLine.line });
          index = bodyResult.index;
        }
        break;
      }

      nodes.push({ type: "if", branches, line: line.line });
      continue;
    }

    nodes.push({ type: "statement", text: line.trimmed, line: line.line });
    index += 1;
  }

  return { nodes, index };
}

function parseRequiredBody(lines, startIndex, parentIndent, parentLine) {
  const bodyIndex = nextMeaningful(lines, startIndex);
  if (bodyIndex >= lines.length || lines[bodyIndex].indent <= parentIndent) {
    throw new FriendlyError("После строки с двоеточием нужен блок кода с отступом.", parentLine);
  }
  return parseBlock(lines, bodyIndex, lines[bodyIndex].indent);
}

function tokenizeExpression(source, line) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "\"" || ch === "'") {
      const quote = ch;
      let value = "";
      i += 1;
      while (i < source.length && source[i] !== quote) {
        value += source[i];
        i += 1;
      }
      if (source[i] !== quote) throw new FriendlyError("Похоже, строка не закрыта кавычкой.", line);
      i += 1;
      tokens.push({ type: "string", value });
      continue;
    }
    const two = source.slice(i, i + 2);
    if ([">=", "<=", "==", "!="].includes(two)) {
      tokens.push({ type: "op", value: two });
      i += 2;
      continue;
    }
    if ("+-*/%(),<>[]".includes(ch)) {
      tokens.push({ type: ch === "," ? "comma" : "op", value: ch });
      i += 1;
      continue;
    }
    if (/\d/.test(ch)) {
      let raw = "";
      while (i < source.length && /[\d.]/.test(source[i])) {
        raw += source[i];
        i += 1;
      }
      tokens.push({ type: "number", value: Number(raw) });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let name = "";
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        name += source[i];
        i += 1;
      }
      tokens.push({ type: "name", value: name });
      continue;
    }
    throw new FriendlyError(`Не понимаю символ "${ch}" в выражении.`, line);
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

function makeExpressionParser(source, context, line) {
  const tokens = tokenizeExpression(source, line);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];
  const match = (value) => {
    if (peek().value === value) {
      take();
      return true;
    }
    return false;
  };

  function parseExpression() {
    return parseOr();
  }

  function parseOr() {
    let left = parseAnd();
    while (peek().type === "name" && peek().value === "or") {
      take();
      left = Boolean(left) || Boolean(parseAnd());
    }
    return left;
  }

  function parseAnd() {
    let left = parseCompare();
    while (peek().type === "name" && peek().value === "and") {
      take();
      left = Boolean(left) && Boolean(parseCompare());
    }
    return left;
  }

  function parseCompare() {
    let left = parseAdd();
    while ([">", "<", ">=", "<=", "==", "!="].includes(peek().value)) {
      const op = take().value;
      const right = parseAdd();
      if (op === ">") left = left > right;
      if (op === "<") left = left < right;
      if (op === ">=") left = left >= right;
      if (op === "<=") left = left <= right;
      if (op === "==") left = left === right;
      if (op === "!=") left = left !== right;
    }
    return left;
  }

  function parseAdd() {
    let left = parseMul();
    while (peek().value === "+" || peek().value === "-") {
      const op = take().value;
      const right = parseMul();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseMul() {
    let left = parseUnary();
    while (["*", "/", "%"].includes(peek().value)) {
      const op = take().value;
      const right = parseUnary();
      if (op === "*") left *= right;
      if (op === "/") left /= right;
      if (op === "%") left %= right;
    }
    return left;
  }

  function parseUnary() {
    if (match("-")) return -parseUnary();
    if (peek().type === "name" && peek().value === "not") {
      take();
      return !Boolean(parseUnary());
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const token = take();
    if (token.type === "number" || token.type === "string") return token.value;
    if (token.value === "(") {
      const value = parseExpression();
      if (!match(")")) throw new FriendlyError("Не хватает закрывающей скобки.", line);
      return value;
    }
    if (token.value === "[") {
      const values = [];
      if (match("]")) return values;
      while (true) {
        values.push(parseExpression());
        if (match("]")) return values;
        if (!match(",")) throw new FriendlyError("В списке значения разделяются запятыми.", line);
      }
    }
    if (token.type === "name") {
      if (token.value === "True") return true;
      if (token.value === "False") return false;
      if (match("(")) {
        const args = [];
        if (!match(")")) {
          while (true) {
            args.push(parseExpression());
            if (match(")")) break;
            if (!match(",")) throw new FriendlyError("Аргументы функции разделяются запятыми.", line);
          }
        }
        return callExpressionFunction(token.value, args, context, line);
      }
      if (Object.prototype.hasOwnProperty.call(context.vars, token.value)) return context.vars[token.value];
      throw new FriendlyError(`Переменной "${token.value}" пока нет. Возможно, в имени опечатка.`, line);
    }
    throw new FriendlyError("Не понимаю это выражение.", line);
  }

  const value = parseExpression();
  if (peek().type !== "eof") throw new FriendlyError("В выражении остался лишний кусочек кода.", line);
  return value;
}

function evalExpression(source, context, line) {
  return makeExpressionParser(source, context, line);
}

function splitArgs(source) {
  const args = [];
  let current = "";
  let depth = 0;
  let quote = null;

  for (const ch of source) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "\"" || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() !== "") args.push(current.trim());
  return args;
}

function callExpressionFunction(name, args, context, line) {
  if (name === "front_is_clear") return sensorClear(context.level, context.state, "front", line);
  if (name === "right_is_clear") return sensorClear(context.level, context.state, "right", line);
  if (name === "left_is_clear") return sensorClear(context.level, context.state, "left", line);
  if (name === "at_goal") return atGoal(context.level, context.state);
  if (name === "on_item") return onItem(context.state);
  if (name === "read_number") return readNumber(context, line);
  if (name === "len") return args[0]?.length ?? 0;
  if (name === "int") return Number.parseInt(args[0], 10);
  if (name === "str") return String(args[0]);
  if (name === "bool") return Boolean(args[0]);
  throw new FriendlyError(`Функцию "${name}" нельзя использовать внутри выражения в этой учебной среде.`, line);
}

function sensorClear(level, state, side, line) {
  let dir = state.robot.dir;
  if (side === "right") dir = DIRS[(DIRS.indexOf(dir) + 1) % 4];
  if (side === "left") dir = DIRS[(DIRS.indexOf(dir) + 3) % 4];
  const delta = DELTAS[dir];
  const x = state.robot.x + delta.x;
  const y = state.robot.y + delta.y;
  return !isWall(level, x, y);
}

function atGoal(level, state) {
  const goal = level.world.goal;
  return Boolean(goal && state.robot.x === goal.x && state.robot.y === goal.y);
}

function onItem(state) {
  return state.items.some((item) => item.x === state.robot.x && item.y === state.robot.y);
}

function readNumber(context, line) {
  if (context.state.inputUsed >= context.state.inputQueue.length) {
    throw new FriendlyError("Программа пытается прочитать число, но во входе больше ничего нет.", line);
  }
  const value = Number(context.state.inputQueue[context.state.inputUsed]);
  context.state.inputUsed += 1;
  context.record(line, `read_number() взял ${value}`);
  return value;
}

function executeLimitedProgram(level, code, options = {}) {
  const ast = parseProgram(code);
  const state = createInitialState(level, options.inputQueue);
  const events = [];
  const context = {
    level,
    state,
    vars: state.variables,
    functions: {},
    ops: 0,
    maxOps: 800,
    silent: Boolean(options.silent),
    record(line, message, kind = "step") {
      if (this.silent) return;
      events.push({ line, message, kind, snapshot: snapshot(this.state) });
    }
  };

  try {
    executeBlock(ast, context);
    state.success = checkSolution(level, code, state).ok;
    if (!options.silent) events.push({ line: null, message: "Программа закончилась.", kind: "done", snapshot: snapshot(state) });
  } catch (error) {
    if (error instanceof FriendlyError) {
      state.error = { message: error.message, line: error.line, raw: error.raw };
      if (!options.silent) events.push({ line: error.line, message: error.message, kind: "error", snapshot: snapshot(state) });
    } else {
      state.error = { message: "Что-то пошло не так. Попробуй проверить последнюю строку.", line: null, raw: String(error) };
      if (!options.silent) events.push({ line: null, message: state.error.message, kind: "error", snapshot: snapshot(state) });
    }
  }

  return { state, events };
}

async function executeProgram(level, code, options = {}) {
  const runtime = await pyodideReadyPromise;
  if (!runtime) {
    return executeLimitedProgram(level, code, options);
  }

  runtime.globals.set("__robot_source", code);
  runtime.globals.set("__robot_level_json", JSON.stringify(level));
  runtime.globals.set("__robot_input_json", options.inputQueue ? JSON.stringify(options.inputQueue) : "");
  runtime.globals.set("__robot_silent", Boolean(options.silent));

  try {
    const raw = runtime.runPython("_run_robot_program(__robot_source, __robot_level_json, __robot_input_json, __robot_silent)");
    return JSON.parse(raw);
  } catch (error) {
    const state = createInitialState(level, options.inputQueue);
    state.error = {
      message: "Python runtime остановился на неожиданной ошибке.",
      line: null,
      raw: String(error)
    };
    return {
      state,
      events: [{ line: null, message: state.error.message, kind: "error", snapshot: snapshot(state) }]
    };
  }
}

function executeBlock(nodes, context) {
  for (const node of nodes) {
    context.ops += 1;
    if (context.ops > context.maxOps) {
      throw new FriendlyError("Программа сделала слишком много шагов. Возможно, цикл повторяется слишком долго.", node.line);
    }

    if (node.type === "def") {
      context.functions[node.name] = node.body;
      context.record(node.line, `Создали функцию ${node.name}().`);
      continue;
    }

    if (node.type === "for") {
      const values = evalRange(node.rangeExpr, context, node.line);
      context.record(node.line, `Цикл for начался: ${values.length} повторений.`);
      for (const value of values) {
        context.vars[node.varName] = value;
        context.record(node.line, `${node.varName} = ${value}`);
        executeBlock(node.body, context);
      }
      continue;
    }

    if (node.type === "if") {
      let chosen = null;
      for (const branch of node.branches) {
        if (branch.kind === "else") {
          chosen = branch;
          context.record(branch.line, "else выбран, потому что предыдущие условия не сработали.");
          break;
        }
        const value = Boolean(evalExpression(branch.condition, context, branch.line));
        context.record(branch.line, `${branch.kind} проверил условие: ${value ? "True" : "False"}`);
        if (value) {
          chosen = branch;
          break;
        }
      }
      if (chosen) executeBlock(chosen.body, context);
      continue;
    }

    executeStatement(node.text, context, node.line);
  }
}

function evalRange(source, context, line) {
  const parts = splitArgs(source).map((part) => evalExpression(part, context, line));
  let start = 0;
  let stop = 0;
  if (parts.length === 1) {
    stop = parts[0];
  } else if (parts.length === 2) {
    start = parts[0];
    stop = parts[1];
  } else {
    throw new FriendlyError("Пока range поддерживает один или два аргумента: range(4) или range(1, 5).", line);
  }
  const values = [];
  for (let i = start; i < stop; i += 1) values.push(i);
  return values;
}

function executeStatement(text, context, line) {
  if (text === "pass") {
    context.record(line, "pass ничего не делает. Это временная заглушка, которую можно заменить кодом.");
    return;
  }

  const assign = text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
  if (assign) {
    const value = evalExpression(assign[2], context, line);
    context.vars[assign[1]] = value;
    context.record(line, `${assign[1]} = ${formatValue(value)}`);
    return;
  }

  const call = text.match(/^([A-Za-z_]\w*)\s*\((.*)\)\s*$/);
  if (call) {
    const name = call[1];
    const args = splitArgs(call[2]).map((arg) => evalExpression(arg, context, line));
    executeCall(name, args, context, line);
    return;
  }

  if (/^[A-Za-z_]\w*$/.test(text)) {
    throw new FriendlyError(`Похоже, ты написала ${text} без скобок. Команда вызывается так: ${text}()`, line);
  }

  throw new FriendlyError("Пока я понимаю только команды, присваивания, if, for и def.", line);
}

function executeCall(name, args, context, line) {
  if (context.functions[name]) {
    context.record(line, `Вызвали функцию ${name}().`);
    executeBlock(context.functions[name], context);
    return;
  }

  if (name === "go") {
    const steps = args.length === 0 ? 1 : Number(args[0]);
    if (!Number.isInteger(steps) || steps < 0) {
      throw new FriendlyError("go(n) ждет целое число шагов: например go(3).", line);
    }
    context.record(line, `go(${steps})`);
    for (let i = 0; i < steps; i += 1) {
      const next = nextCell(context.state.robot);
      if (isWall(context.level, next.x, next.y)) {
        throw new FriendlyError("Робот попытался пойти в стену. Проверь маршрут перед этой строкой.", line);
      }
      context.state.robot.x = next.x;
      context.state.robot.y = next.y;
      context.record(line, `Робот сделал шаг в клетку (${next.x}, ${next.y}).`, "move");
    }
    return;
  }

  if (name === "turn_right" || name === "turn_left" || name === "turn") {
    let amount = 90;
    if (name === "turn_left") amount = -90;
    if (name === "turn") amount = Number(args[0]);
    if (![90, -90, 180, -180].includes(amount)) {
      throw new FriendlyError("turn(angle) поддерживает 90, -90 и 180.", line);
    }
    turn(context.state.robot, amount);
    context.record(line, `${name}() повернул робота. Теперь направление: ${context.state.robot.dir}.`, "turn");
    return;
  }

  if (name === "pick") {
    const index = context.state.items.findIndex((item) => item.x === context.state.robot.x && item.y === context.state.robot.y);
    if (index === -1) {
      throw new FriendlyError("Здесь нет предмета. pick() работает только на клетке с предметом.", line);
    }
    const [item] = context.state.items.splice(index, 1);
    context.state.robot.inventory.push(item.name || "предмет");
    context.record(line, `Робот поднял: ${item.name || "предмет"}.`, "item");
    return;
  }

  if (name === "say" || name === "print") {
    const text = args.map(formatValue).join(" ");
    context.state.output.push(text);
    context.record(line, `${name}: ${text}`, "output");
    return;
  }

  const hint = closestCommand(name);
  const extra = hint ? ` Может быть, ты имела в виду ${hint}()?` : "";
  throw new FriendlyError(`Я не знаю команду "${name}".${extra}`, line);
}

function closestCommand(name) {
  const commands = ["go", "turn_left", "turn_right", "turn", "pick", "say", "print", "front_is_clear", "right_is_clear", "left_is_clear", "read_number"];
  return commands.find((command) => levenshtein(name, command) <= 2);
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

function formatValue(value) {
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  if (value && typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}

function checkSolution(level, code, state) {
  const checks = level.checks || {};
  const issues = [];
  if (state.error) issues.push(state.error.message);
  if (checks.reachGoal && !atGoal(level, state)) issues.push("Робот пока не на звезде.");
  if (checks.minItems && state.robot.inventory.length < checks.minItems) issues.push(`Нужно собрать предметов: ${checks.minItems}.`);
  if (checks.expectedOutput !== undefined) {
    const actual = state.output.join("\n").trim();
    if (actual !== String(checks.expectedOutput)) issues.push(`Ожидался вывод ${checks.expectedOutput}, а получился ${actual || "пустой вывод"}.`);
  }
  for (const token of checks.mustUse || []) {
    if (!code.includes(token)) issues.push(`В этом уровне нужно использовать ${token}.`);
  }
  return { ok: issues.length === 0, issues };
}

async function runHiddenTests(level, code, visibleState) {
  const tests = level.checks?.tests || [];
  if (tests.length === 0 || visibleState.error) return null;
  const visible = checkSolution(level, code, visibleState);
  const failures = [];
  for (const test of tests) {
    const result = await executeProgram(level, code, { silent: true, inputQueue: test.inputQueue });
    const actual = result.state.output.join("\n").trim();
    if (result.state.error || actual !== String(test.expectedOutput)) {
      failures.push({ input: test.inputQueue, expected: test.expectedOutput, actual: actual || "пустой вывод" });
    }
  }
  if (visible.ok && failures.length > 0) {
    return {
      ok: false,
      message: `Код сработал на примере, но не на другом вводе. Попробуй читать данные через read_number(), а не печатать готовый ответ.`,
      failures
    };
  }
  return { ok: failures.length === 0, failures };
}

function renderAll(state = currentState) {
  renderGrid(state);
  renderState(state);
  renderCodeLines();
  renderTrace();
}

function renderGrid(state) {
  const world = currentLevel.world;
  els.grid.style.gridTemplateColumns = `repeat(${world.width}, 1fr)`;
  els.grid.style.gridTemplateRows = `repeat(${world.height}, 1fr)`;
  els.grid.innerHTML = "";
  const walls = new Set((world.walls || []).map(cellKey));
  const itemCells = new Map((state.items || []).map((item) => [cellKey(item), item]));
  const goal = world.goal;

  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (walls.has(`${x},${y}`)) cell.classList.add("wall");
      if (goal && goal.x === x && goal.y === y) cell.classList.add("goal");
      if (itemCells.has(`${x},${y}`)) cell.classList.add("item");
      if (state.robot.x === x && state.robot.y === y) {
        const robot = document.createElement("div");
        robot.className = `robot dir-${state.robot.dir}`;
        robot.setAttribute("aria-label", "Робот");
        cell.appendChild(robot);
      }
      els.grid.appendChild(cell);
    }
  }
}

function renderState(state) {
  const goal = currentLevel.world.goal;
  const inventory = state.robot.inventory.length ? state.robot.inventory.join(", ") : "пусто";
  els.robotState.innerHTML = `
    <dt>Позиция</dt><dd>(${state.robot.x}, ${state.robot.y})</dd>
    <dt>Направление</dt><dd>${state.robot.dir}</dd>
    <dt>Рюкзак</dt><dd>${inventory}</dd>
    <dt>Цель</dt><dd>${goal ? `(${goal.x}, ${goal.y})` : "нет"}</dd>
  `;

  const varNames = Object.keys(state.variables);
  els.variablesPanel.textContent = varNames.length
    ? varNames.map((name) => `${name} = ${formatValue(state.variables[name])}`).join("\n")
    : "Пока пусто";
  els.variablesPanel.classList.toggle("empty-note", varNames.length === 0);

  const input = currentLevel.inputQueue || [];
  els.inputPanel.textContent = input.length ? input.map((value, index) => `${index + 1}. ${value}`).join("\n") : "В этом уровне ввода нет";
  els.outputPanel.textContent = state.output.join("\n");
}

function renderCodeLines() {
  const activeLine = getActiveLine();
  const lines = els.codeEditor.value.split(/\r?\n/);
  els.codeLines.innerHTML = "";
  lines.forEach((text, index) => {
    const row = document.createElement("div");
    row.className = "code-line";
    if (index + 1 === activeLine) row.classList.add("active");
    row.innerHTML = `<div class="code-line-number">${index + 1}</div><div class="code-line-text"></div>`;
    row.querySelector(".code-line-text").textContent = text || " ";
    els.codeLines.appendChild(row);
  });
}

function renderTrace() {
  els.tracePanel.innerHTML = "";
  const events = lastRun?.events || [];
  events.forEach((event, index) => {
    const item = document.createElement("li");
    item.textContent = event.line ? `строка ${event.line}: ${event.message}` : event.message;
    if (index === playbackIndex) item.classList.add("active");
    els.tracePanel.appendChild(item);
  });
  const active = els.tracePanel.querySelector(".active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function getActiveLine() {
  if (!lastRun || playbackIndex < 0) return null;
  return lastRun.events[playbackIndex]?.line || null;
}

function setBanner(message, type = "") {
  els.statusBanner.textContent = message;
  els.statusBanner.className = `status-banner ${type}`.trim();
}

async function prepareRun() {
  const code = els.codeEditor.value;
  setExecutionControlsDisabled(true);
  setBanner("Python выполняет программу...");
  lastRun = await executeProgram(currentLevel, code);
  setExecutionControlsDisabled(false);
  playbackIndex = -1;
  currentState = createInitialState(currentLevel);
  renderAll(currentState);
  if (lastRun.state.error) {
    setBanner(lastRun.state.error.message, "error");
  } else {
    setBanner("Программа готова к пошаговому просмотру.");
  }
}

async function showEvent(index) {
  if (!lastRun || lastRun.events.length === 0) return;
  playbackIndex = Math.max(0, Math.min(index, lastRun.events.length - 1));
  const event = lastRun.events[playbackIndex];
  currentState = event.snapshot;
  renderAll(currentState);
  if (event.kind === "error") {
    setBanner(event.message, "error");
  } else if (playbackIndex === lastRun.events.length - 1) {
    await finishRunMessage();
  } else {
    setBanner(event.message);
  }
}

async function finishRunMessage() {
  const code = els.codeEditor.value;
  const result = checkSolution(currentLevel, code, currentState);
  const hidden = await runHiddenTests(currentLevel, code, currentState);
  if (currentState.error) {
    setBanner(currentState.error.message, "error");
  } else if (hidden && !hidden.ok && hidden.message) {
    setBanner(hidden.message, "error");
  } else if (result.ok) {
    setBanner("Уровень пройден. Теперь попробуй объяснить, почему решение работает.", "ok");
  } else {
    setBanner(result.issues[0], "error");
  }
}

async function runToEnd() {
  await prepareRun();
  if (lastRun.events.length === 0) return;
  await showEvent(lastRun.events.length - 1);
}

async function step() {
  if (!lastRun || playbackIndex >= lastRun.events.length - 1) await prepareRun();
  if (!lastRun || lastRun.events.length === 0) return;
  await showEvent(playbackIndex + 1);
}

function resetWorld() {
  lastRun = null;
  playbackIndex = -1;
  currentState = createInitialState(currentLevel);
  renderAll(currentState);
  setBanner("Мир сброшен. Перед запуском попробуй предсказать результат.");
}

function loadLevel(level) {
  currentLevel = level;
  els.levelConcept.textContent = level.concept;
  els.levelTitle.textContent = level.title;
  els.levelDescription.textContent = level.description;
  els.levelGoal.textContent = level.goalText;
  els.codeEditor.value = level.starterCode;
  resetWorld();
}

function restoreStarter() {
  els.codeEditor.value = currentLevel.starterCode;
  resetWorld();
}

function init() {
  window.ROBOT_LEVELS.forEach((level, index) => {
    const option = document.createElement("option");
    option.value = level.id;
    option.textContent = level.title;
    if (index === 0) option.selected = true;
    els.levelSelect.appendChild(option);
  });

  els.levelSelect.addEventListener("change", () => {
    const next = window.ROBOT_LEVELS.find((level) => level.id === els.levelSelect.value);
    loadLevel(next);
  });
  els.codeEditor.addEventListener("input", () => {
    lastRun = null;
    playbackIndex = -1;
    renderCodeLines();
    setBanner("Код изменен. Запусти заново или сделай Step.");
  });
  els.runButton.addEventListener("click", () => {
    runToEnd().catch((error) => {
      setExecutionControlsDisabled(false);
      setBanner("Не получилось выполнить программу. Проверь консоль браузера.", "error");
      console.error(error);
    });
  });
  els.stepButton.addEventListener("click", () => {
    step().catch((error) => {
      setExecutionControlsDisabled(false);
      setBanner("Не получилось выполнить шаг. Проверь консоль браузера.", "error");
      console.error(error);
    });
  });
  els.resetButton.addEventListener("click", resetWorld);
  els.starterButton.addEventListener("click", restoreStarter);
  loadLevel(currentLevel);
  pyodideReadyPromise = initPyodideEngine();
}

init();
