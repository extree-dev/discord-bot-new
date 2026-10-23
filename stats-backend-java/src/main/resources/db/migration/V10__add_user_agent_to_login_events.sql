-- V10: User-Agent в журнале входов (для "Unknown Device" → "Chrome on Windows")
ALTER TABLE stats_login_events ADD COLUMN IF NOT EXISTS user_agent TEXT;
