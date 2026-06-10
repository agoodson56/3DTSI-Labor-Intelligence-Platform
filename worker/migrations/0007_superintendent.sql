-- Migration 0007: superintendent assignment from the PM project form.
ALTER TABLE projects ADD COLUMN superintendent_name TEXT NOT NULL DEFAULT '';
