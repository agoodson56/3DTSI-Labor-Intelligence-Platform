-- Migration 0004: systems in scope per project (populated by the Excel
-- importer or project setup; when present, the field UI only offers these
-- systems for the project).

CREATE TABLE project_systems (
  project_id INTEGER NOT NULL REFERENCES projects(id),
  system_id  INTEGER NOT NULL REFERENCES systems(id),
  PRIMARY KEY (project_id, system_id)
);
