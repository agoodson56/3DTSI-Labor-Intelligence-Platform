-- Migration 0002: seed roles, systems, devices, task types, cable types

-- ---------- ROLES ----------
INSERT INTO roles (name, description, permissions, is_system) VALUES
('Administrator',      'Full system access',                                  '["*"]', 1),
('Executive',          'Executive dashboards, intelligence, reports',         '["dashboard.view","intelligence.view","reports.view","projects.view","sessions.view_all","users.view"]', 1),
('Operations Manager', 'Operations oversight, projects, reports, catalog',    '["dashboard.view","intelligence.view","reports.view","projects.view","projects.manage","sessions.view_all","sessions.create","catalog.manage","users.view","customers.manage"]', 1),
('Estimator',          'Labor intelligence and production rates for bids',    '["intelligence.view","reports.view","projects.view","dashboard.view"]', 1),
('Project Manager',    'Project labor tracking and reporting',                '["dashboard.view","intelligence.view","reports.view","projects.view","projects.manage","sessions.view_all","sessions.create"]', 1),
('Superintendent',     'Multi-crew field supervision',                        '["dashboard.view","reports.view","projects.view","sessions.view_all","sessions.create","intelligence.view"]', 1),
('Foreman',            'Crew leadership and production entry',                '["projects.view","sessions.create","sessions.view_all","reports.view"]', 1),
('Lead Technician',    'Senior field technician',                             '["projects.view","sessions.create","sessions.view_own"]', 1),
('Technician',         'Field production entry',                              '["projects.view","sessions.create","sessions.view_own"]', 1);

-- ---------- SYSTEMS ----------
INSERT INTO systems (name, sort_order) VALUES
('Structured Cabling', 1),
('Fiber Optics',       2),
('CCTV',               3),
('Access Control',     4),
('Fire Alarm',         5),
('Networking',         6),
('Audio Visual',       7),
('Service',            8);

-- ---------- DEVICES ----------
-- Structured Cabling
INSERT INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Cat5e',            'feet', 0.010),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Cat6',             'feet', 0.010),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Cat6A',            'feet', 0.012),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Fiber',            'feet', 0.012),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Backbone Cabling', 'feet', 0.015),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Patch Panels',     'each', 1.50),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Faceplates',       'each', 0.25),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Cabinets',         'each', 4.00),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Racks',            'each', 3.00),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Certification',    'each', 0.05);

-- Fiber Optics
INSERT INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Fiber Optics'), 'Single Mode',         'feet', 0.012),
((SELECT id FROM systems WHERE name='Fiber Optics'), 'Multi Mode',          'feet', 0.012),
((SELECT id FROM systems WHERE name='Fiber Optics'), 'Splice Enclosures',   'each', 2.50),
((SELECT id FROM systems WHERE name='Fiber Optics'), 'Fiber Panels',        'each', 1.50),
((SELECT id FROM systems WHERE name='Fiber Optics'), 'Fiber Termination',   'each', 0.30),
((SELECT id FROM systems WHERE name='Fiber Optics'), 'Fiber Certification', 'each', 0.10);

-- CCTV
INSERT INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='CCTV'), 'Fixed Cameras',        'each', 2.00),
((SELECT id FROM systems WHERE name='CCTV'), 'PTZ Cameras',          'each', 3.00),
((SELECT id FROM systems WHERE name='CCTV'), 'Multi-Sensor Cameras', 'each', 3.00),
((SELECT id FROM systems WHERE name='CCTV'), 'NVR',                  'each', 4.00),
((SELECT id FROM systems WHERE name='CCTV'), 'Servers',              'each', 4.00),
((SELECT id FROM systems WHERE name='CCTV'), 'Monitors',             'each', 1.50),
((SELECT id FROM systems WHERE name='CCTV'), 'Video Walls',          'each', 8.00),
((SELECT id FROM systems WHERE name='CCTV'), 'Pole Cameras',         'each', 6.00),
((SELECT id FROM systems WHERE name='CCTV'), 'Analytics Devices',    'each', 2.00);

-- Access Control
INSERT INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Access Control'), 'Card Readers',     'each', 2.80),
((SELECT id FROM systems WHERE name='Access Control'), 'Mag Locks',        'each', 3.00),
((SELECT id FROM systems WHERE name='Access Control'), 'Electric Strikes', 'each', 2.50),
((SELECT id FROM systems WHERE name='Access Control'), 'Door Contacts',    'each', 1.00),
((SELECT id FROM systems WHERE name='Access Control'), 'REX Devices',      'each', 1.25),
((SELECT id FROM systems WHERE name='Access Control'), 'Motion Sensors',   'each', 1.25),
((SELECT id FROM systems WHERE name='Access Control'), 'Panels',           'each', 6.00),
((SELECT id FROM systems WHERE name='Access Control'), 'Power Supplies',   'each', 2.00);

-- Fire Alarm
INSERT INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Smoke Detectors',    'each', 1.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Heat Detectors',     'each', 1.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Beam Detectors',     'each', 4.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Duct Detectors',     'each', 2.50),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Pull Stations',      'each', 1.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Horns',              'each', 1.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Strobes',            'each', 1.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Horn/Strobes',       'each', 1.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Monitor Modules',    'each', 1.25),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Control Modules',    'each', 1.25),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Power Supplies',     'each', 2.50),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Fire Alarm Panels',  'each', 12.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Annunciators',       'each', 3.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Relays',             'each', 1.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Aspirating Systems', 'each', 16.00);

-- Networking
INSERT INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Networking'), 'Switches',               'each', 2.00),
((SELECT id FROM systems WHERE name='Networking'), 'Routers',                'each', 2.50),
((SELECT id FROM systems WHERE name='Networking'), 'Wireless Access Points', 'each', 1.50),
((SELECT id FROM systems WHERE name='Networking'), 'Firewalls',              'each', 3.00),
((SELECT id FROM systems WHERE name='Networking'), 'Network Controllers',    'each', 3.00);

-- Audio Visual
INSERT INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Audio Visual'), 'Displays',        'each', 2.50),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Projectors',      'each', 4.00),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Speakers',        'each', 1.00),
((SELECT id FROM systems WHERE name='Audio Visual'), 'DSP Equipment',   'each', 3.00),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Control Systems', 'each', 6.00);

-- Service
INSERT INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Service'), 'Service Calls',            'each', 2.00),
((SELECT id FROM systems WHERE name='Service'), 'Troubleshooting',          'each', 2.00),
((SELECT id FROM systems WHERE name='Service'), 'Testing',                  'each', 1.00),
((SELECT id FROM systems WHERE name='Service'), 'Certification',            'each', 1.00),
((SELECT id FROM systems WHERE name='Service'), 'Preventative Maintenance', 'each', 2.00);

-- ---------- TASK TYPES ----------
INSERT INTO task_types (name, sort_order) VALUES
('Device Installation', 1),
('Cable Pulling',       2),
('Device Termination',  3),
('Programming',         4),
('Testing',             5),
('Troubleshooting',     6),
('Service',             7),
('Commissioning',       8),
('Certification',       9),
('Material Handling',  10),
('Documentation',      11),
('Training',           12),
('Head-End Buildout',  13),
('Rack Buildout',      14);

-- ---------- CABLE TYPES ----------
INSERT INTO cable_types (name) VALUES
('Cat5e'),
('Cat6'),
('Cat6A'),
('Fiber'),
('Fire Alarm Cable'),
('Coax'),
('Composite');
