# Python Robot Tutor

Статический учебный сайт для GitHub Pages. Цель - помочь новичку увидеть, как программа выполняется по шагам: строка кода, действие робота, изменение состояния, переменные и вывод.

## Ссылки

- Сайт: https://alekseishevkoplias.github.io/python-robot-tutor/
- Репозиторий: https://github.com/AlekseiShevkoplias/python-robot-tutor

## Что уже есть

- 17 учебных уровней.
- Редактор кода.
- Кнопки Run, Step, Reset, Starter.
- Сетка с роботом, стенами, целью и предметами.
- Подсветка текущей строки в панели шагов.
- Панель переменных, ввода, вывода и трассы.
- Дружелюбные ошибки для частых ситуаций.
- Проверки результата.
- Скрытые тесты для уровней на ввод/вывод, чтобы ловить хардкодинг.

## Поддерживаемый учебный Python

Это намеренно маленькое подмножество Python:

```python
go()
go(3)
turn_left()
turn_right()
turn(180)
pick()
say("готово")
print(123)

if front_is_clear():
    go()
else:
    turn_right()

for i in range(4):
    go()

def turn_around():
    turn_right()
    turn_right()

x = read_number()
print(x + 1)
```

Поддерживаются переменные, числа, строки, списки, арифметика, сравнения, `and`, `or`, `not`, `if/elif/else`, `for range(...)`, функции без параметров.

## Локальный запуск

Можно просто открыть `index.html` в браузере.

Или запустить локальный сервер:

```bash
python3 -m http.server 8000
```

Потом открыть:

```text
http://localhost:8000/robot_tutor_pages/
```

Если запускать сервер из папки `robot_tutor_pages`, адрес будет:

```text
http://localhost:8000/
```

## Деплой на GitHub Pages

После авторизации GitHub CLI:

```bash
gh auth refresh -h github.com
```

Можно создать репозиторий и включить Pages:

```bash
cd /Users/aleksei_shevkoplias/Documents/programming_lessons/robot_tutor_pages
git init
git add .
git commit -m "Add Python Robot Tutor"
gh repo create python-robot-tutor --public --source=. --remote=origin --push
gh api repos/AlekseiShevkoplias/python-robot-tutor/pages -X POST -f source.branch=main -f source.path=/
```

После включения сайт обычно появляется по адресу:

```text
https://alekseishevkoplias.github.io/python-robot-tutor/
```
