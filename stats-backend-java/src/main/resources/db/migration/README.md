# Миграции схемы (Flyway)

Каталог миграций Flyway для stats-backend-java. После перехода с Node
(`stats-backend/db.js` удаляется) — это единственный источник схемы БД.

## Правила

1. **Никогда не править уже применённую миграцию.** Flyway хранит
   контрольные суммы в `flyway_schema_history`; изменённый файл даст
   ошибку «Migration checksum mismatch» на следующем старте.
2. **Новые изменения — новым файлом** с версией на единицу больше:
   `V2__add_something.sql`, `V3__another_change.sql`.
3. **Имя файла:** `V<номер>__<snake_case_описание>.sql` (два
   подчёркивания между версией и описанием).
4. **Baseline:** `V1__init.sql` — это снимок схемы на момент перехода с
   Node. На проде, где таблицы уже созданы Node-овым `db.js`,
   `spring.flyway.baseline-on-migrate: true` запишет baseline-версию 0,
   и V1 применится как «уже накатанная» (все `IF NOT EXISTS` пройдут
   вхолостую). На пустой БД V1 создаёт всё с нуля.

## Как проверить

```bash
cd stats-backend-java
mvn -B flyway:info   # список миграций и их статус