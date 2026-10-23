ALTER TABLE stats_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Делаем тебя админом на проде
UPDATE stats_users SET is_admin = true WHERE email = 'theromkaa@yandex.ru';