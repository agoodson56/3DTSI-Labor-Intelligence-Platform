-- Migration 0005: foreman / lead assignments captured on the PM project form.
ALTER TABLE projects ADD COLUMN foreman_name TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN lead_name TEXT NOT NULL DEFAULT '';
