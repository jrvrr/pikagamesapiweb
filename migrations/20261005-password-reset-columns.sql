ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token VARCHAR(128);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_reset_token_unique ON usuarios (reset_token) WHERE reset_token IS NOT NULL;
