function corridorWorld(length, items = []) {
  return {
    width: Math.max(length + 1, 1),
    height: 1,
    start: { x: 0, y: 0, dir: "E" },
    walls: [],
    goal: { x: length, y: 0 },
    items: items.map((x, index) => ({ x, y: 0, name: `предмет ${index + 1}` }))
  };
}

function oneTurnWorld(firstSegment, secondSegment) {
  return {
    width: firstSegment + 1,
    height: secondSegment + 1,
    start: { x: 0, y: 0, dir: "E" },
    walls: [],
    goal: { x: firstSegment, y: secondSegment },
    items: []
  };
}

function pathWorld(segments, itemPathIndexes = []) {
  const directionDeltas = {
    N: { x: 0, y: -1 },
    E: { x: 1, y: 0 },
    S: { x: 0, y: 1 },
    W: { x: -1, y: 0 }
  };
  const path = [{ x: 0, y: 0 }];
  let x = 0;
  let y = 0;

  for (const segment of segments) {
    const delta = directionDeltas[segment.dir];
    for (let step = 0; step < segment.steps; step += 1) {
      x += delta.x;
      y += delta.y;
      path.push({ x, y });
    }
  }

  const minX = Math.min(...path.map((cell) => cell.x));
  const minY = Math.min(...path.map((cell) => cell.y));
  const shifted = path.map((cell) => ({ x: cell.x - minX, y: cell.y - minY }));
  const maxX = Math.max(...shifted.map((cell) => cell.x));
  const maxY = Math.max(...shifted.map((cell) => cell.y));
  const open = new Set(shifted.map((cell) => `${cell.x},${cell.y}`));
  const walls = [];

  for (let wallY = 0; wallY <= maxY; wallY += 1) {
    for (let wallX = 0; wallX <= maxX; wallX += 1) {
      if (!open.has(`${wallX},${wallY}`)) walls.push({ x: wallX, y: wallY });
    }
  }

  return {
    width: maxX + 1,
    height: maxY + 1,
    start: { x: shifted[0].x, y: shifted[0].y, dir: segments[0].dir },
    walls,
    goal: shifted[shifted.length - 1],
    items: itemPathIndexes.map((index, itemIndex) => ({
      x: shifted[index].x,
      y: shifted[index].y,
      name: `предмет ${itemIndex + 1}`
    }))
  };
}

function caseDef(kind, label, world, extra = {}) {
  return { kind, label, world, ...extra };
}

window.ROBOT_LEVELS = [
  {
    id: "gen_corridor_01",
    title: "G1. Звезда где-то впереди",
    concept: "Правило для разных входов",
    description: "Одна карта - это только пример. Проверка at_goal() помогает понять, стоим ли мы уже на звезде.",
    goalText: "Дойди до звезды. Длина коридора может меняться от 0 до 8 клеток.",
    staysSame: [
      "робот смотрит вдоль коридора",
      "звезда находится впереди",
      "между роботом и звездой нет стен"
    ],
    canChange: [
      "расстояние до звезды",
      "звезда может быть прямо на стартовой клетке",
      "коридор может быть коротким или длинным"
    ],
    tools: ["go()", "at_goal()"],
    world: corridorWorld(3),
    starterCode: "# Нужно правило, а не число шагов для одного примера.\n# Подумай: какая проверка говорит, что пора остановиться?\npass",
    checks: { reachGoal: true },
    cases: [
      caseDef("example", "distance = 3", corridorWorld(3)),
      caseDef("edge", "goal at start", corridorWorld(0)),
      caseDef("edge", "distance = 1", corridorWorld(1)),
      caseDef("edge", "long corridor", corridorWorld(8)),
      caseDef("generated", "distance = 5", corridorWorld(5)),
      caseDef("generated", "distance = 2", corridorWorld(2))
    ]
  },
  {
    id: "gen_items_01",
    title: "G2. Предметы могут быть где угодно",
    concept: "Условия + edge cases",
    description: "Код должен собирать все предметы в коридоре, даже если предмет лежит на старте или на финише.",
    goalText: "Собери все предметы и дойди до звезды.",
    staysSame: [
      "мир остается прямым коридором",
      "звезда всегда в конце",
      "все предметы лежат на пути"
    ],
    canChange: [
      "количество предметов",
      "позиции предметов",
      "предмет может лежать на последней клетке"
    ],
    tools: ["go()", "at_goal()", "on_item()", "pick()", "say(value)"],
    world: corridorWorld(4, [1, 3]),
    starterCode: "items = 0\n\n# Проверь каждую клетку пути.\n# Если на клетке есть предмет, подними его и обнови счетчик.\n# В конце выведи items.\npass",
    checks: { reachGoal: true },
    cases: [
      caseDef("example", "two items", corridorWorld(4, [1, 3]), { checks: { minItems: 2, expectedOutput: "2" } }),
      caseDef("edge", "no items", corridorWorld(3, []), { checks: { minItems: 0, expectedOutput: "0" } }),
      caseDef("edge", "item at start", corridorWorld(3, [0]), { checks: { minItems: 1, expectedOutput: "1" } }),
      caseDef("edge", "item at finish", corridorWorld(3, [3]), { checks: { minItems: 1, expectedOutput: "1" } }),
      caseDef("generated", "many items", corridorWorld(5, [1, 2, 4]), { checks: { minItems: 3, expectedOutput: "3" } })
    ]
  },
  {
    id: "gen_turn_01",
    title: "G3. Поворот в неизвестном месте",
    concept: "Структура input меняется",
    description: "Ты знаешь контракт: путь идет прямо, потом один раз поворачивает направо. Но место поворота неизвестно.",
    goalText: "Дойди до звезды на любом пути с одним правым поворотом.",
    staysSame: [
      "путь без развилок",
      "ровно один правый поворот",
      "звезда в конце пути"
    ],
    canChange: [
      "длина первого прямого участка",
      "длина второго прямого участка",
      "место поворота"
    ],
    tools: ["go()", "turn_right()", "front_is_clear()", "at_goal()"],
    world: oneTurnWorld(3, 2),
    starterCode: "# Место поворота неизвестно.\n# Подумай: как понять, что дальше прямо идти уже нельзя?\npass",
    checks: { reachGoal: true },
    cases: [
      caseDef("example", "3 then 2", oneTurnWorld(3, 2)),
      caseDef("edge", "short first segment", oneTurnWorld(1, 3)),
      caseDef("edge", "short second segment", oneTurnWorld(4, 1)),
      caseDef("generated", "5 then 3", oneTurnWorld(5, 3)),
      caseDef("generated", "2 then 4", oneTurnWorld(2, 4))
    ]
  },
  {
    id: "gen_number_01",
    title: "G4. Число управляет движением",
    concept: "Input как данные",
    description: "Теперь меняется не только мир: число во входе тоже часть задачи. Код должен читать число, а не угадывать его.",
    goalText: "Прочитай число и пройди ровно столько клеток.",
    staysSame: [
      "звезда находится на расстоянии, равном входному числу",
      "робот смотрит на звезду",
      "между ними нет стен"
    ],
    canChange: [
      "число во входе",
      "длина коридора",
      "число может быть 0"
    ],
    tools: ["read_number()", "go(n)"],
    world: corridorWorld(2),
    inputQueue: [2],
    starterCode: "# Во входе лежит число шагов.\n# Сначала прочитай его, потом используй в движении.\npass",
    checks: { reachGoal: true },
    cases: [
      caseDef("example", "input = 2", corridorWorld(2), { inputQueue: [2] }),
      caseDef("edge", "input = 0", corridorWorld(0), { inputQueue: [0] }),
      caseDef("edge", "input = 1", corridorWorld(1), { inputQueue: [1] }),
      caseDef("generated", "input = 5", corridorWorld(5), { inputQueue: [5] }),
      caseDef("generated", "input = 7", corridorWorld(7), { inputQueue: [7] })
    ]
  },
  {
    id: "gen_path_01",
    title: "G5. Извилистый путь без развилок",
    concept: "Алгоритм вместо маршрута",
    description: "Путь может поворачивать в разных местах. Команды, подобранные под одну карту, больше не спасают.",
    goalText: "Дойди до звезды на любом пути без развилок.",
    staysSame: [
      "есть ровно один открытый путь",
      "развилок нет",
      "звезда всегда в конце пути"
    ],
    canChange: [
      "количество поворотов",
      "длина прямых участков",
      "поворот может быть направо или налево"
    ],
    tools: ["go()", "turn_left()", "turn_right()", "front_is_clear()", "right_is_clear()", "left_is_clear()", "at_goal()"],
    world: pathWorld([{ dir: "E", steps: 3 }, { dir: "S", steps: 2 }, { dir: "E", steps: 2 }]),
    starterCode: "# Маршрут меняется, поэтому нужны проверки.\n# На каждом шаге решай: идти вперед, повернуть направо или повернуть налево.\npass",
    checks: { reachGoal: true },
    cases: [
      caseDef("example", "right then left", pathWorld([{ dir: "E", steps: 3 }, { dir: "S", steps: 2 }, { dir: "E", steps: 2 }])),
      caseDef("edge", "turn immediately", pathWorld([{ dir: "E", steps: 1 }, { dir: "S", steps: 3 }, { dir: "E", steps: 1 }])),
      caseDef("edge", "mostly straight", pathWorld([{ dir: "E", steps: 5 }, { dir: "S", steps: 1 }])),
      caseDef("generated", "three turns", pathWorld([{ dir: "E", steps: 2 }, { dir: "S", steps: 2 }, { dir: "E", steps: 2 }, { dir: "S", steps: 2 }])),
      caseDef("generated", "long middle", pathWorld([{ dir: "E", steps: 2 }, { dir: "S", steps: 4 }, { dir: "E", steps: 3 }]))
    ]
  },
  {
    id: "gen_path_items_01",
    title: "G6. Собери на неизвестном пути",
    concept: "Композиция условий",
    description: "Теперь нужно одновременно двигаться по неизвестному пути и не пропускать предметы.",
    goalText: "Собери все предметы на пути, дойди до звезды и выведи их количество.",
    staysSame: [
      "путь один и без развилок",
      "все предметы лежат на пути",
      "звезда в конце"
    ],
    canChange: [
      "форма пути",
      "количество предметов",
      "предмет может быть на старте или на финише"
    ],
    tools: ["go()", "turn_left()", "turn_right()", "front_is_clear()", "right_is_clear()", "left_is_clear()", "at_goal()", "on_item()", "pick()", "say(value)"],
    world: pathWorld([{ dir: "E", steps: 3 }, { dir: "S", steps: 2 }, { dir: "E", steps: 2 }], [1, 5]),
    starterCode: "items = 0\n\n# Тут две задачи сразу:\n# 1. пройти по неизвестному пути;\n# 2. не пропустить предметы на клетках.\n# В конце выведи items.\npass",
    checks: { reachGoal: true },
    cases: [
      caseDef("example", "two items on path", pathWorld([{ dir: "E", steps: 3 }, { dir: "S", steps: 2 }, { dir: "E", steps: 2 }], [1, 5]), { checks: { minItems: 2, expectedOutput: "2" } }),
      caseDef("edge", "item at start", pathWorld([{ dir: "E", steps: 2 }, { dir: "S", steps: 2 }], [0]), { checks: { minItems: 1, expectedOutput: "1" } }),
      caseDef("edge", "item at finish", pathWorld([{ dir: "E", steps: 2 }, { dir: "S", steps: 2 }], [4]), { checks: { minItems: 1, expectedOutput: "1" } }),
      caseDef("generated", "three items", pathWorld([{ dir: "E", steps: 2 }, { dir: "S", steps: 3 }, { dir: "E", steps: 2 }], [1, 3, 7]), { checks: { minItems: 3, expectedOutput: "3" } }),
      caseDef("generated", "no items", pathWorld([{ dir: "E", steps: 4 }, { dir: "S", steps: 1 }], []), { checks: { minItems: 0, expectedOutput: "0" } })
    ]
  },
  {
    id: "gen_double_01",
    title: "G7. Пройди в два раза больше",
    concept: "Input → вычисление → действие",
    description: "Число из входа надо не просто использовать, а преобразовать. Это уже маленькое вычисление.",
    goalText: "Прочитай число n и пройди 2 * n клеток.",
    staysSame: [
      "звезда стоит на расстоянии 2 * n",
      "робот смотрит на звезду",
      "коридор свободный"
    ],
    canChange: [
      "число n",
      "расстояние до звезды",
      "n может быть 0"
    ],
    tools: ["read_number()", "go(n)"],
    world: corridorWorld(4),
    inputQueue: [2],
    starterCode: "# Во входе лежит n.\n# Нужно пройти не n, а в два раза больше.\npass",
    checks: { reachGoal: true },
    cases: [
      caseDef("example", "n = 2", corridorWorld(4), { inputQueue: [2] }),
      caseDef("edge", "n = 0", corridorWorld(0), { inputQueue: [0] }),
      caseDef("edge", "n = 1", corridorWorld(2), { inputQueue: [1] }),
      caseDef("generated", "n = 4", corridorWorld(8), { inputQueue: [4] }),
      caseDef("generated", "n = 6", corridorWorld(12), { inputQueue: [6] })
    ]
  },
  {
    id: "gen_sum_until_zero_01",
    title: "G8. Сумма до нуля",
    concept: "Цикл с неизвестным числом входов",
    description: "Программа не знает заранее, сколько чисел придет. Ноль означает стоп.",
    goalText: "Читай числа, пока не встретишь 0, и напечатай сумму предыдущих чисел.",
    staysSame: [
      "в конце входа всегда есть 0",
      "нужно напечатать одну сумму",
      "0 не добавляется к сумме"
    ],
    canChange: [
      "сколько чисел до нуля",
      "какие это числа",
      "0 может быть первым"
    ],
    tools: ["read_number()", "print(value)"],
    world: corridorWorld(0),
    inputQueue: [2, 3, 0],
    starterCode: "# Чисел может быть разное количество.\n# Ноль означает: больше складывать не надо.\npass",
    checks: { expectedOutput: "5" },
    cases: [
      caseDef("example", "2, 3, 0", corridorWorld(0), { inputQueue: [2, 3, 0], checks: { expectedOutput: "5" } }),
      caseDef("edge", "0 immediately", corridorWorld(0), { inputQueue: [0], checks: { expectedOutput: "0" } }),
      caseDef("edge", "one number", corridorWorld(0), { inputQueue: [7, 0], checks: { expectedOutput: "7" } }),
      caseDef("generated", "four numbers", corridorWorld(0), { inputQueue: [1, 4, 2, 3, 0], checks: { expectedOutput: "10" } }),
      caseDef("generated", "larger numbers", corridorWorld(0), { inputQueue: [10, 20, 5, 0], checks: { expectedOutput: "35" } })
    ]
  },
  {
    id: "seq_01",
    title: "1. Дойти до звезды",
    concept: "Последовательность",
    description: "Робот выполняет команды сверху вниз. Перед запуском предскажи, где он окажется.",
    goalText: "Дойди до звезды.",
    world: { width: 5, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [], goal: { x: 4, y: 2 }, items: [] },
    starterCode: "# Робот смотрит на восток.\n# Добавь команды, чтобы дойти до звезды.\ngo()",
    checks: { reachGoal: true }
  },
  {
    id: "seq_02",
    title: "2. Поворот меняет путь",
    concept: "Порядок команд",
    description: "Одинаковые команды в другом порядке ведут в другое место.",
    goalText: "Пройди угол и остановись на звезде.",
    world: { width: 5, height: 5, start: { x: 1, y: 3, dir: "E" }, walls: [], goal: { x: 3, y: 1 }, items: [] },
    starterCode: "# Сначала дойди до угла.\ngo()\ngo()\n# Потом нужен поворот и еще шаги.",
    checks: { reachGoal: true }
  },
  {
    id: "seq_03",
    title: "3. Исправь маршрут",
    concept: "Точная команда",
    description: "Код почти правильный, но порядок строк надо проверить.",
    goalText: "Исправь код так, чтобы робот дошел до звезды.",
    world: { width: 6, height: 5, start: { x: 1, y: 1, dir: "E" }, walls: [], goal: { x: 4, y: 3 }, items: [] },
    starterCode: "# Этот маршрут почти правильный, но чего-то не хватает.\ngo()\ngo()\nturn_right()\ngo()",
    checks: { reachGoal: true }
  },
  {
    id: "wall_01",
    title: "4. Стена не пропускает",
    concept: "Ошибки как подсказки",
    description: "Если робот идет в стену, программа останавливается и показывает понятную ошибку.",
    goalText: "Обойди стену и дойди до звезды.",
    world: { width: 6, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [{ x: 3, y: 2 }], goal: { x: 5, y: 2 }, items: [] },
    starterCode: "# Впереди есть стена.\n# Сначала попробуй запустить этот код и прочитать ошибку.\ngo()\ngo()\n# Потом измени маршрут, чтобы обойти стену.",
    checks: { reachGoal: true }
  },
  {
    id: "loop_01",
    title: "5. Повторение",
    concept: "Цикл for",
    description: "Цикл повторяет строки с отступом. Посмотри, сколько раз выполнится go().",
    goalText: "Используй цикл, чтобы дойти до звезды.",
    world: { width: 7, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [], goal: { x: 5, y: 2 }, items: [] },
    starterCode: "# Замени повторение циклом for.\ngo()\ngo()\n# Нужно дойти до звезды.",
    checks: { reachGoal: true, mustUse: ["for"] }
  },
  {
    id: "loop_02",
    title: "6. Квадратный путь",
    concept: "Тело цикла",
    description: "В цикле может быть несколько строк. Отступ показывает, что повторяется.",
    goalText: "Сделай полный квадрат и вернись на звезду.",
    world: { width: 6, height: 6, start: { x: 2, y: 2, dir: "E" }, walls: [], goal: { x: 2, y: 2 }, items: [] },
    starterCode: "# Внутри цикла должны быть шаги и поворот.\nfor i in range(4):\n    pass",
    checks: { reachGoal: true, mustUse: ["for", "go()", "turn_right"] }
  },
  {
    id: "if_01",
    title: "7. Если впереди свободно",
    concept: "Условие if",
    description: "Один и тот же код может вести себя по-разному на разных картах.",
    goalText: "Проверь путь впереди и сделай безопасный шаг.",
    world: { width: 5, height: 5, start: { x: 2, y: 3, dir: "N" }, walls: [], goal: { x: 2, y: 2 }, items: [] },
    starterCode: "# Если впереди свободно, сделай шаг.\nif front_is_clear():\n    pass\nelse:\n    turn_right()",
    checks: { reachGoal: true, mustUse: ["if"] }
  },
  {
    id: "if_02",
    title: "8. Обойди препятствие",
    concept: "if / else",
    description: "Датчики мира возвращают True или False. По ним программа выбирает действие.",
    goalText: "Обойди стену и дойди до звезды.",
    world: { width: 6, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [{ x: 2, y: 2 }], goal: { x: 4, y: 1 }, items: [] },
    starterCode: "# Впереди стена. Используй if/else, чтобы выбрать путь.\nif front_is_clear():\n    go()\nelse:\n    turn_left()\n    # продолжи маршрут",
    checks: { reachGoal: true, mustUse: ["if"] }
  },
  {
    id: "func_01",
    title: "9. Своя команда",
    concept: "Функции",
    description: "Функция создает новую команду из уже известных команд.",
    goalText: "Создай turn_around() и используй ее.",
    world: { width: 5, height: 5, start: { x: 2, y: 2, dir: "E" }, walls: [], goal: { x: 1, y: 2 }, items: [] },
    starterCode: "# Создай функцию, которая разворачивает робота.\ndef turn_around():\n    pass\n\nturn_around()\n# После разворота нужен шаг.",
    checks: { reachGoal: true, mustUse: ["def"] }
  },
  {
    id: "func_02",
    title: "10. Функция убирает повтор",
    concept: "Функции и повторение",
    description: "Если кусок маршрута повторяется, его удобно назвать.",
    goalText: "Используй функцию step_turn(), чтобы дойти до звезды.",
    world: { width: 6, height: 6, start: { x: 1, y: 4, dir: "E" }, walls: [], goal: { x: 3, y: 2 }, items: [] },
    starterCode: "# Заполни функцию повторяемым кусочком маршрута.\ndef step_turn():\n    pass\n\nstep_turn()\nstep_turn()\n# Закончи маршрут.",
    checks: { reachGoal: true, mustUse: ["def"] }
  },
  {
    id: "var_01",
    title: "11. Переменная хранит число",
    concept: "Переменные",
    description: "Переменная - имя для значения. Следи за панелью переменных.",
    goalText: "Сохрани число шагов в переменную и дойди до цели.",
    world: { width: 7, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [], goal: { x: 5, y: 2 }, items: [] },
    starterCode: "# Запиши нужное число шагов в переменную.\nsteps = 1\ngo(steps)",
    checks: { reachGoal: true, mustUse: ["="] }
  },
  {
    id: "var_02",
    title: "12. Счетчик",
    concept: "Обновление переменной",
    description: "Строка x = x + 1 берет старое значение и записывает новое.",
    goalText: "Дойди до звезды и выведи количество шагов.",
    world: { width: 6, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [], goal: { x: 4, y: 2 }, items: [] },
    starterCode: "steps = 0\n\nfor i in range(3):\n    go()\n    # увеличь счетчик\n\n# выведи количество шагов",
    checks: { reachGoal: true, expectedOutput: "3", mustUse: ["for"] }
  },
  {
    id: "item_01",
    title: "13. Поднять предмет",
    concept: "Состояние и предметы",
    description: "Предмет исчезает с клетки и появляется в рюкзаке робота.",
    goalText: "Подними предмет и дойди до звезды.",
    world: { width: 6, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [], goal: { x: 4, y: 2 }, items: [{ x: 2, y: 2, name: "кристалл" }] },
    starterCode: "# Сначала дойди до предмета.\ngo()\n# Подними предмет.\n# Потом дойди до звезды.",
    checks: { reachGoal: true, minItems: 1 }
  },
  {
    id: "io_01",
    title: "14. Прочитай число",
    concept: "Ввод и вывод",
    description: "Ввод приходит снаружи. Решение должно работать не только для видимого примера.",
    goalText: "Прочитай число и напечатай число плюс 1.",
    world: { width: 1, height: 1, start: { x: 0, y: 0, dir: "N" }, walls: [], goal: null, items: [] },
    inputQueue: [5],
    starterCode: "# Прочитай число из панели ввода.\nx = read_number()\n# Напечатай число плюс 1.",
    checks: { expectedOutput: "6", tests: [{ inputQueue: [10], expectedOutput: "11" }, { inputQueue: [2], expectedOutput: "3" }] }
  },
  {
    id: "io_02",
    title: "15. Сложи два числа",
    concept: "Несколько входов",
    description: "Каждый read_number() берет следующее число из панели ввода.",
    goalText: "Прочитай два числа и напечатай их сумму.",
    world: { width: 1, height: 1, start: { x: 0, y: 0, dir: "N" }, walls: [], goal: null, items: [] },
    inputQueue: [7, 4],
    starterCode: "# read_number() каждый раз берет следующее число.\na = read_number()\nb = read_number()\n# Напечатай сумму.",
    checks: { expectedOutput: "11", tests: [{ inputQueue: [3, 8], expectedOutput: "11" }, { inputQueue: [20, 1], expectedOutput: "21" }] }
  },
  {
    id: "io_03",
    title: "16. Больше из двух",
    concept: "Ввод + условия",
    description: "Здесь нужен и ввод, и условие. Не подставляй числа из примера руками.",
    goalText: "Прочитай два числа и напечатай большее.",
    world: { width: 1, height: 1, start: { x: 0, y: 0, dir: "N" }, walls: [], goal: null, items: [] },
    inputQueue: [8, 3],
    starterCode: "a = read_number()\nb = read_number()\n\nif a > b:\n    pass\nelse:\n    pass",
    checks: { expectedOutput: "8", tests: [{ inputQueue: [1, 9], expectedOutput: "9" }, { inputQueue: [12, 4], expectedOutput: "12" }] }
  },
  {
    id: "final_01",
    title: "17. Собери и дойди",
    concept: "Мини-проект",
    description: "Собери вместе команды, цикл, условие, переменную и вывод.",
    goalText: "Собери два предмета, дойди до звезды и выведи количество предметов.",
    world: {
      width: 7,
      height: 6,
      start: { x: 1, y: 4, dir: "E" },
      walls: [{ x: 3, y: 4 }, { x: 3, y: 3 }],
      goal: { x: 5, y: 2 },
      items: [{ x: 2, y: 4, name: "ключ" }, { x: 5, y: 3, name: "карта" }]
    },
    starterCode: "items = 0\n\n# Собери первый предмет.\ngo()\n\n# Обойди стены, собери второй предмет и дойди до звезды.\n\n# В конце выведи количество предметов.\nsay(items)",
    checks: { reachGoal: true, minItems: 2, expectedOutput: "2" }
  }
];
