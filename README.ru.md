# cs2assets

[English](README.md) | **Русский**

Единый репозиторий с данными Counter-Strike 2: тексты и переводы из игровых файлов, изображения предметов и готовый JSON API.
Заменяет три отдельных репозитория (CSGO-API, counter-strike-file-tracker, counter-strike-image-tracker) одним быстрым конвейером.

## Как это работает

1. **check** (каждые 5 минут) — анонимный вход в Steam, сравнение manifest id с `data/manifestId.txt`. Если ничего не изменилось, работа заканчивается за секунды.
2. **update** — один вход в Steam, скачиваются только изменившиеся архивы `pak01_NNN.vpk` (сравнение по `data/fileSha.json`), по 3 параллельно.
3. Тексты (`items_game`, `csgo_*`) конвертируются в `data/*.json`, изображения декомпилируются через Source2Viewer-CLI.
4. Для каждого нового изображения: статический CDN Steam (SHA1 + HEAD-запрос) → копия в `images/` (ссылка на этот репозиторий).
5. Генератор из `generator/` собирает API и документацию, результат публикуется на GitHub Pages (в git не коммитится).
6. **market** (раз в сутки, опционально) — улучшает ссылки до CDN торговой площадки точечными запросами с лимитом и паузой при 429.

## Лимиты Steam

Раньше новые изображения искались на торговой площадке, где у новых предметов ещё нет лотов. Поэтому поиск не находил их, а повторные запросы расходовали лимит.
Теперь изображение берётся из игровых файлов сразу, а торговая площадка — лишь необязательное улучшение: запросы ограничены бюджетом, неудачные предметы повторяются с растущим интервалом (1/3/7/14/30 дней), при первом 429 запросы останавливаются, пауза сохраняется в `data/market-state.json`.

## Структура

| Путь | Назначение |
| --- | --- |
| `src/` | конвейер на TypeScript (Node 24, без сборки) |
| `generator/` | генератор API (копия CSGO-API) |
| `data/` | JSON с данными игры, `images.json`, состояние |
| `images/` | изображения, которых нет на CDN, питомцы, превью хайлайтов |
| `scripts/import-forks.ts` | разовый импорт из старых репозиториев |

## Использование

```bash
npm ci
node scripts/import-forks.ts        # один раз: перенос данных из форков
node src/index.ts update --force    # полный прогон (нужны STEAM_USERNAME и STEAM_PASSWORD)
node src/index.ts generate          # пересобрать только API
node src/index.ts market --budget=40
npm run typecheck
```

Загрузка идёт через анонимную сессию Steam (депо CS2 публичное). Необязательные секреты `USERNAME` / `PASSWORD` (передаются как `STEAM_USERNAME` / `STEAM_PASSWORD`) нужны только как запасной вариант, если анонимная загрузка не удалась. Переменная `LANGUAGES` (по умолчанию `en,ru,uk,zh-CN`, либо `all`).

## Благодарности и лицензии

Проект основан на работе других авторов, подробности в [NOTICE](NOTICE):

- [ByMykel](https://github.com/ByMykel) — [CSGO-API](https://github.com/ByMykel/CSGO-API), [counter-strike-file-tracker](https://github.com/ByMykel/counter-strike-file-tracker), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker) (MIT). Каталог `generator/` — копия CSGO-API.
- [csfloat/cs-files](https://github.com/csfloat/cs-files) — подход к скачиванию файлов из Steam.
- [SteamTracking/GameTracking-CS2](https://github.com/SteamTracking/GameTracking-CS2) — справочные данные.
- [ValveResourceFormat](https://github.com/ValveResourceFormat/ValveResourceFormat) — Source2Viewer-CLI.
- [node-steam-user](https://github.com/DoctorMcKay/node-steam-user).

Counter-Strike 2 и игровые ресурсы принадлежат Valve Corporation.
