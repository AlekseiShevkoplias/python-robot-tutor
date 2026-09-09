window.ROBOT_LEVELS = [
  {
    id: "seq_01",
    title: "1. Дойти до звезды",
    concept: "Последовательность",
    description: "Робот выполняет команды сверху вниз. Перед запуском предскажи, где он окажется.",
    goalText: "Дойди до звезды.",
    world: { width: 5, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [], goal: { x: 4, y: 2 }, items: [] },
    starterCode: "go()\ngo()\ngo()",
    checks: { reachGoal: true }
  },
  {
    id: "seq_02",
    title: "2. Поворот меняет путь",
    concept: "Порядок команд",
    description: "Одинаковые команды в другом порядке ведут в другое место.",
    goalText: "Пройди угол и остановись на звезде.",
    world: { width: 5, height: 5, start: { x: 1, y: 3, dir: "E" }, walls: [], goal: { x: 3, y: 1 }, items: [] },
    starterCode: "go()\ngo()\nturn_left()\ngo()\ngo()",
    checks: { reachGoal: true }
  },
  {
    id: "seq_03",
    title: "3. Исправь маршрут",
    concept: "Точная команда",
    description: "Код почти правильный, но порядок строк надо проверить.",
    goalText: "Исправь код так, чтобы робот дошел до звезды.",
    world: { width: 6, height: 5, start: { x: 1, y: 1, dir: "E" }, walls: [], goal: { x: 4, y: 3 }, items: [] },
    starterCode: "go()\nturn_right()\ngo()\ngo()\ngo()",
    checks: { reachGoal: true }
  },
  {
    id: "wall_01",
    title: "4. Стена не пропускает",
    concept: "Ошибки как подсказки",
    description: "Если робот идет в стену, программа останавливается и показывает понятную ошибку.",
    goalText: "Обойди стену и дойди до звезды.",
    world: { width: 6, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [{ x: 3, y: 2 }], goal: { x: 5, y: 2 }, items: [] },
    starterCode: "go()\nturn_left()\ngo()\nturn_right()\ngo()\ngo()\nturn_right()\ngo()\nturn_left()\ngo()",
    checks: { reachGoal: true }
  },
  {
    id: "loop_01",
    title: "5. Повторение",
    concept: "Цикл for",
    description: "Цикл повторяет строки с отступом. Посмотри, сколько раз выполнится go().",
    goalText: "Используй цикл, чтобы дойти до звезды.",
    world: { width: 7, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [], goal: { x: 5, y: 2 }, items: [] },
    starterCode: "for i in range(4):\n    go()",
    checks: { reachGoal: true, mustUse: ["for"] }
  },
  {
    id: "loop_02",
    title: "6. Квадратный путь",
    concept: "Тело цикла",
    description: "В цикле может быть несколько строк. Отступ показывает, что повторяется.",
    goalText: "Сделай полный квадрат и вернись на звезду.",
    world: { width: 6, height: 6, start: { x: 2, y: 2, dir: "E" }, walls: [], goal: { x: 2, y: 2 }, items: [] },
    starterCode: "for i in range(4):\n    go()\n    go()\n    turn_right()",
    checks: { reachGoal: true, mustUse: ["for"] }
  },
  {
    id: "if_01",
    title: "7. Если впереди свободно",
    concept: "Условие if",
    description: "Один и тот же код может вести себя по-разному на разных картах.",
    goalText: "Проверь путь впереди и сделай безопасный шаг.",
    world: { width: 5, height: 5, start: { x: 2, y: 3, dir: "N" }, walls: [], goal: { x: 2, y: 2 }, items: [] },
    starterCode: "if front_is_clear():\n    go()\nelse:\n    turn_right()",
    checks: { reachGoal: true, mustUse: ["if"] }
  },
  {
    id: "if_02",
    title: "8. Обойди препятствие",
    concept: "if / else",
    description: "Датчики мира возвращают True или False. По ним программа выбирает действие.",
    goalText: "Обойди стену и дойди до звезды.",
    world: { width: 6, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [{ x: 2, y: 2 }], goal: { x: 4, y: 1 }, items: [] },
    starterCode: "if front_is_clear():\n    go()\nelse:\n    turn_left()\n    go()\n    turn_right()\n    go()\n    go()",
    checks: { reachGoal: true, mustUse: ["if"] }
  },
  {
    id: "func_01",
    title: "9. Своя команда",
    concept: "Функции",
    description: "Функция создает новую команду из уже известных команд.",
    goalText: "Создай turn_around() и используй ее.",
    world: { width: 5, height: 5, start: { x: 2, y: 2, dir: "E" }, walls: [], goal: { x: 1, y: 2 }, items: [] },
    starterCode: "def turn_around():\n    turn_right()\n    turn_right()\n\nturn_around()\ngo()",
    checks: { reachGoal: true, mustUse: ["def"] }
  },
  {
    id: "func_02",
    title: "10. Функция убирает повтор",
    concept: "Функции и повторение",
    description: "Если кусок маршрута повторяется, его удобно назвать.",
    goalText: "Используй функцию step_turn(), чтобы дойти до звезды.",
    world: { width: 6, height: 6, start: { x: 1, y: 4, dir: "E" }, walls: [], goal: { x: 3, y: 2 }, items: [] },
    starterCode: "def step_turn():\n    go()\n    turn_left()\n\nstep_turn()\nstep_turn()\ngo()",
    checks: { reachGoal: true, mustUse: ["def"] }
  },
  {
    id: "var_01",
    title: "11. Переменная хранит число",
    concept: "Переменные",
    description: "Переменная - имя для значения. Следи за панелью переменных.",
    goalText: "Сохрани число шагов в переменную и дойди до цели.",
    world: { width: 7, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [], goal: { x: 5, y: 2 }, items: [] },
    starterCode: "steps = 4\ngo(steps)",
    checks: { reachGoal: true, mustUse: ["="] }
  },
  {
    id: "var_02",
    title: "12. Счетчик",
    concept: "Обновление переменной",
    description: "Строка x = x + 1 берет старое значение и записывает новое.",
    goalText: "Дойди до звезды и выведи количество шагов.",
    world: { width: 6, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [], goal: { x: 4, y: 2 }, items: [] },
    starterCode: "steps = 0\nfor i in range(3):\n    go()\n    steps = steps + 1\nsay(steps)",
    checks: { reachGoal: true, expectedOutput: "3", mustUse: ["for"] }
  },
  {
    id: "item_01",
    title: "13. Поднять предмет",
    concept: "Состояние и предметы",
    description: "Предмет исчезает с клетки и появляется в рюкзаке робота.",
    goalText: "Подними предмет и дойди до звезды.",
    world: { width: 6, height: 5, start: { x: 1, y: 2, dir: "E" }, walls: [], goal: { x: 4, y: 2 }, items: [{ x: 2, y: 2, name: "кристалл" }] },
    starterCode: "go()\npick()\ngo()\ngo()",
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
    starterCode: "x = read_number()\nprint(x + 1)",
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
    starterCode: "a = read_number()\nb = read_number()\nprint(a + b)",
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
    starterCode: "a = read_number()\nb = read_number()\nif a > b:\n    print(a)\nelse:\n    print(b)",
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
    starterCode: "items = 0\n\ngo()\npick()\nitems = items + 1\nturn_left()\ngo()\ngo()\nturn_right()\ngo()\ngo()\nturn_right()\ngo()\npick()\nitems = items + 1\nturn_left()\ngo()\nsay(items)",
    checks: { reachGoal: true, minItems: 2, expectedOutput: "2" }
  }
];

