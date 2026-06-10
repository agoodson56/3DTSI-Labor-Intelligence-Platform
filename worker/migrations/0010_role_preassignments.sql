-- Migration 0010: pre-assigned roles by email. When one of these addresses
-- registers, they receive the listed role instead of the default Technician.
-- Anyone already registered is upgraded immediately.

CREATE TABLE role_preassignments (
  email     TEXT PRIMARY KEY COLLATE NOCASE,
  role_name TEXT NOT NULL
);

INSERT INTO role_preassignments (email, role_name) VALUES
('agoodson@3dtsi.com',  'Administrator'),
('fpedersen@3dtsi.com', 'Administrator'),
('bscarlett@3dtsi.com', 'Project Manager'),
('cortiz@3dtsi.com',    'Project Manager'),
('konstott@3dtsi.com',  'Project Manager'),
('rstalker@3dtsi.com',  'Project Manager'),
('droberts@3dtsi.com',  'Superintendent'),
('epowell@3dtsi.com',   'Superintendent'),
('kgrey@3dtsi.com',     'Superintendent');

-- upgrade anyone already registered
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'Administrator')
WHERE email IN ('agoodson@3dtsi.com', 'fpedersen@3dtsi.com');

UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'Project Manager')
WHERE email IN ('bscarlett@3dtsi.com', 'cortiz@3dtsi.com', 'konstott@3dtsi.com', 'rstalker@3dtsi.com');

UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'Superintendent')
WHERE email IN ('droberts@3dtsi.com', 'epowell@3dtsi.com', 'kgrey@3dtsi.com');
