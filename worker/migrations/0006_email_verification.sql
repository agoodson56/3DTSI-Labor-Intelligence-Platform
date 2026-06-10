-- Migration 0006: self-registration with email verification.
-- Existing users (created by admins) are grandfathered as verified.
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN verify_code TEXT;
ALTER TABLE users ADD COLUMN verify_expires TEXT;
ALTER TABLE users ADD COLUMN reset_code TEXT;
ALTER TABLE users ADD COLUMN reset_expires TEXT;
