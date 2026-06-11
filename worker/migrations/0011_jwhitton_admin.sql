-- Migration 0011: jwhitton@3dtsi.com - Administrator.
INSERT OR REPLACE INTO role_preassignments (email, role_name) VALUES
('jwhitton@3dtsi.com', 'Administrator');

UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'Administrator')
WHERE email = 'jwhitton@3dtsi.com';
