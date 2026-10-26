ALTER TABLE stats_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Никакого seed-а тут быть не должно: миграция схемы не должна
-- зависеть от конкретного email. Сделать кого-то админом — руками:
--   UPDATE stats_users SET is_admin = true WHERE email = '<твой>';
-- или через админку (когда появится первый админ — он уже есть на проде
-- после старой V5, так что просто не откатывай её вручную).