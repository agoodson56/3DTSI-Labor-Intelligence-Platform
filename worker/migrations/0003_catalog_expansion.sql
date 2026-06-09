-- Migration 0003: full 3DTSI device taxonomy (manufacturer-agnostic, device level)
-- Strategy: rename 1:1 matches to preserve recorded labor history, deactivate
-- superseded generics, add new systems and devices. estimate_hours_per_unit
-- values are starting points - tune them in Admin -> Catalog.
-- Note: uses multi-row VALUES (not UNION ALL chains) - D1 limits compound
-- SELECT terms. Every statement is idempotent so partial applies retry safely.

-- ============ SYSTEMS ============
UPDATE systems SET name = 'Fiber Optic Systems'       WHERE name = 'Fiber Optics';
UPDATE systems SET name = 'CCTV / Video Surveillance' WHERE name = 'CCTV';

INSERT OR IGNORE INTO systems (name, sort_order) VALUES
('Intrusion Detection', 5),
('Data Center', 9),
('Specialty Electrical / Low Voltage', 10);

UPDATE systems SET sort_order = 1  WHERE name = 'Structured Cabling';
UPDATE systems SET sort_order = 2  WHERE name = 'Fiber Optic Systems';
UPDATE systems SET sort_order = 3  WHERE name = 'Access Control';
UPDATE systems SET sort_order = 4  WHERE name = 'CCTV / Video Surveillance';
UPDATE systems SET sort_order = 5  WHERE name = 'Intrusion Detection';
UPDATE systems SET sort_order = 6  WHERE name = 'Networking';
UPDATE systems SET sort_order = 7  WHERE name = 'Audio Visual';
UPDATE systems SET sort_order = 8  WHERE name = 'Fire Alarm';
UPDATE systems SET sort_order = 9  WHERE name = 'Data Center';
UPDATE systems SET sort_order = 10 WHERE name = 'Specialty Electrical / Low Voltage';
UPDATE systems SET sort_order = 11 WHERE name = 'Service';

-- ============ STRUCTURED CABLING ============
UPDATE devices SET name = 'Cat5e Cable' WHERE name = 'Cat5e' AND system_id = (SELECT id FROM systems WHERE name='Structured Cabling');
UPDATE devices SET name = 'Cat6 Cable'  WHERE name = 'Cat6'  AND system_id = (SELECT id FROM systems WHERE name='Structured Cabling');
UPDATE devices SET name = 'Cat6A Cable' WHERE name = 'Cat6A' AND system_id = (SELECT id FROM systems WHERE name='Structured Cabling');
UPDATE devices SET name = 'Faceplate'   WHERE name = 'Faceplates' AND system_id = (SELECT id FROM systems WHERE name='Structured Cabling');
UPDATE devices SET name = 'Rack'        WHERE name = 'Racks'      AND system_id = (SELECT id FROM systems WHERE name='Structured Cabling');
UPDATE devices SET name = 'Cabinet'     WHERE name = 'Cabinets'   AND system_id = (SELECT id FROM systems WHERE name='Structured Cabling');
UPDATE devices SET name = 'Patch Panel' WHERE name = 'Patch Panels' AND system_id = (SELECT id FROM systems WHERE name='Structured Cabling');
UPDATE devices SET active = 0 WHERE name = 'Fiber' AND system_id = (SELECT id FROM systems WHERE name='Structured Cabling');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Shielded Cat6A Cable',    'feet', 0.014),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Plenum Cable',            'feet', 0.012),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Non-Plenum Cable',        'feet', 0.010),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'RJ45 Jack',               'each', 0.15),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Surface Mount Box',       'each', 0.25),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Biscuit Jack',            'each', 0.20),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Patch Panel Port',        'each', 0.10),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'J-Hook',                  'each', 0.08),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Cable Tray',              'feet', 0.06),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Conduit',                 'feet', 0.08),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Innerduct',               'feet', 0.03),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Raceway',                 'feet', 0.06),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Ladder Rack',             'feet', 0.10),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Vertical Wire Manager',   'each', 0.50),
((SELECT id FROM systems WHERE name='Structured Cabling'), 'Horizontal Wire Manager', 'each', 0.30);

-- ============ FIBER OPTIC SYSTEMS ============
UPDATE devices SET name = 'Fiber Enclosure'   WHERE name = 'Splice Enclosures' AND system_id = (SELECT id FROM systems WHERE name='Fiber Optic Systems');
UPDATE devices SET name = 'Fiber Patch Panel' WHERE name = 'Fiber Panels'      AND system_id = (SELECT id FROM systems WHERE name='Fiber Optic Systems');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), '6 Strand Fiber',    'feet', 0.010),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), '12 Strand Fiber',   'feet', 0.011),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), '24 Strand Fiber',   'feet', 0.012),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), '48 Strand Fiber',   'feet', 0.014),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), '96 Strand Fiber',   'feet', 0.016),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), '144 Strand Fiber',  'feet', 0.018),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), 'LC Connector',      'each', 0.25),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), 'SC Connector',      'each', 0.25),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), 'ST Connector',      'each', 0.25),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), 'Fiber Shelf',       'each', 1.00),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), 'Fiber Cassette',    'each', 0.50),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), 'Media Converter',   'each', 0.75),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), 'Fiber Transceiver', 'each', 0.25),
((SELECT id FROM systems WHERE name='Fiber Optic Systems'), 'Fiber Splice Tray', 'each', 1.00);

-- ============ ACCESS CONTROL ============
UPDATE devices SET name = 'Card Reader'           WHERE name = 'Card Readers'     AND system_id = (SELECT id FROM systems WHERE name='Access Control');
UPDATE devices SET name = 'Maglock'               WHERE name = 'Mag Locks'        AND system_id = (SELECT id FROM systems WHERE name='Access Control');
UPDATE devices SET name = 'Electric Strike'       WHERE name = 'Electric Strikes' AND system_id = (SELECT id FROM systems WHERE name='Access Control');
UPDATE devices SET name = 'Door Contact'          WHERE name = 'Door Contacts'    AND system_id = (SELECT id FROM systems WHERE name='Access Control');
UPDATE devices SET name = 'Request To Exit (REX)' WHERE name = 'REX Devices'      AND system_id = (SELECT id FROM systems WHERE name='Access Control');
UPDATE devices SET name = 'Power Supply'          WHERE name = 'Power Supplies'   AND system_id = (SELECT id FROM systems WHERE name='Access Control');
UPDATE devices SET active = 0 WHERE name IN ('Panels', 'Motion Sensors') AND system_id = (SELECT id FROM systems WHERE name='Access Control');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Access Control'), 'Keypad Reader',              'each', 2.50),
((SELECT id FROM systems WHERE name='Access Control'), 'Mullion Reader',             'each', 2.80),
((SELECT id FROM systems WHERE name='Access Control'), 'Biometric Reader',           'each', 3.50),
((SELECT id FROM systems WHERE name='Access Control'), 'Electrified Lever Set',      'each', 4.00),
((SELECT id FROM systems WHERE name='Access Control'), 'Electrified Panic Hardware', 'each', 5.00),
((SELECT id FROM systems WHERE name='Access Control'), 'Door Operator',              'each', 6.00),
((SELECT id FROM systems WHERE name='Access Control'), 'Motion REX',                 'each', 1.25),
((SELECT id FROM systems WHERE name='Access Control'), 'Push Button REX',            'each', 1.00),
((SELECT id FROM systems WHERE name='Access Control'), 'Single Door Controller',     'each', 4.00),
((SELECT id FROM systems WHERE name='Access Control'), 'Two Door Controller',        'each', 5.00),
((SELECT id FROM systems WHERE name='Access Control'), 'Four Door Controller',       'each', 6.00),
((SELECT id FROM systems WHERE name='Access Control'), 'Intelligent Controller',     'each', 8.00),
((SELECT id FROM systems WHERE name='Access Control'), 'Card',                       'each', 0.02),
((SELECT id FROM systems WHERE name='Access Control'), 'Fob',                        'each', 0.02),
((SELECT id FROM systems WHERE name='Access Control'), 'Mobile Credential',          'each', 0.05);

-- ============ CCTV / VIDEO SURVEILLANCE ============
UPDATE devices SET name = 'PTZ Camera'          WHERE name = 'PTZ Cameras'          AND system_id = (SELECT id FROM systems WHERE name='CCTV / Video Surveillance');
UPDATE devices SET name = 'Multi-Sensor Camera' WHERE name = 'Multi-Sensor Cameras' AND system_id = (SELECT id FROM systems WHERE name='CCTV / Video Surveillance');
UPDATE devices SET name = 'Video Server'        WHERE name = 'Servers'              AND system_id = (SELECT id FROM systems WHERE name='CCTV / Video Surveillance');
UPDATE devices SET name = 'Monitor'             WHERE name = 'Monitors'             AND system_id = (SELECT id FROM systems WHERE name='CCTV / Video Surveillance');
UPDATE devices SET active = 0 WHERE name IN ('Fixed Cameras', 'Pole Cameras', 'Video Walls', 'Analytics Devices') AND system_id = (SELECT id FROM systems WHERE name='CCTV / Video Surveillance');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='CCTV / Video Surveillance'), 'Fixed Dome Camera',   'each', 1.75),
((SELECT id FROM systems WHERE name='CCTV / Video Surveillance'), 'Fixed Bullet Camera', 'each', 1.75),
((SELECT id FROM systems WHERE name='CCTV / Video Surveillance'), 'Fisheye Camera',      'each', 2.00),
((SELECT id FROM systems WHERE name='CCTV / Video Surveillance'), 'Thermal Camera',      'each', 2.50),
((SELECT id FROM systems WHERE name='CCTV / Video Surveillance'), 'LPR Camera',          'each', 3.00),
((SELECT id FROM systems WHERE name='CCTV / Video Surveillance'), 'DVR',                 'each', 3.00),
((SELECT id FROM systems WHERE name='CCTV / Video Surveillance'), 'Storage Array',       'each', 4.00),
((SELECT id FROM systems WHERE name='CCTV / Video Surveillance'), 'Camera Mount',        'each', 0.50),
((SELECT id FROM systems WHERE name='CCTV / Video Surveillance'), 'Pole Mount',          'each', 2.00),
((SELECT id FROM systems WHERE name='CCTV / Video Surveillance'), 'Corner Mount',        'each', 1.00),
((SELECT id FROM systems WHERE name='CCTV / Video Surveillance'), 'Housing',             'each', 0.75),
((SELECT id FROM systems WHERE name='CCTV / Video Surveillance'), 'Heater Blower Kit',   'each', 0.75);

-- ============ INTRUSION DETECTION (new) ============
INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Door Contact',           'each', 0.75),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Window Contact',         'each', 0.75),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Glass Break Detector',   'each', 1.00),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Motion Detector',        'each', 1.00),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Dual Technology Motion', 'each', 1.00),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Beam Detector',          'each', 3.00),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Panic Button',           'each', 0.75),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Intrusion Panel',        'each', 4.00),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Keypad',                 'each', 1.00),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Expansion Module',       'each', 1.00),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Communicator',           'each', 1.50),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Siren',                  'each', 1.00),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Strobe',                 'each', 1.00),
((SELECT id FROM systems WHERE name='Intrusion Detection'), 'Sounder',                'each', 1.00);

-- ============ NETWORKING ============
UPDATE devices SET name = 'Router'             WHERE name = 'Routers'             AND system_id = (SELECT id FROM systems WHERE name='Networking');
UPDATE devices SET name = 'Firewall'           WHERE name = 'Firewalls'           AND system_id = (SELECT id FROM systems WHERE name='Networking');
UPDATE devices SET name = 'Network Controller' WHERE name = 'Network Controllers' AND system_id = (SELECT id FROM systems WHERE name='Networking');
UPDATE devices SET active = 0 WHERE name IN ('Switches', 'Wireless Access Points') AND system_id = (SELECT id FROM systems WHERE name='Networking');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Networking'), 'Layer 2 Switch',       'each', 2.00),
((SELECT id FROM systems WHERE name='Networking'), 'Layer 3 Switch',       'each', 2.50),
((SELECT id FROM systems WHERE name='Networking'), 'PoE Switch',           'each', 2.00),
((SELECT id FROM systems WHERE name='Networking'), 'Industrial Switch',    'each', 2.50),
((SELECT id FROM systems WHERE name='Networking'), 'Indoor Access Point',  'each', 1.50),
((SELECT id FROM systems WHERE name='Networking'), 'Outdoor Access Point', 'each', 3.00),
((SELECT id FROM systems WHERE name='Networking'), 'Wireless Bridge',      'each', 3.00),
((SELECT id FROM systems WHERE name='Networking'), 'Antenna',              'each', 1.50),
((SELECT id FROM systems WHERE name='Networking'), 'VPN Appliance',        'each', 3.00),
((SELECT id FROM systems WHERE name='Networking'), 'UPS',                  'each', 2.00),
((SELECT id FROM systems WHERE name='Networking'), 'PDU',                  'each', 1.00),
((SELECT id FROM systems WHERE name='Networking'), 'Network Rack',         'each', 3.00),
((SELECT id FROM systems WHERE name='Networking'), 'Network Cabinet',      'each', 4.00);

-- ============ AUDIO VISUAL ============
UPDATE devices SET name = 'Projector'      WHERE name = 'Projectors'      AND system_id = (SELECT id FROM systems WHERE name='Audio Visual');
UPDATE devices SET name = 'DSP Processor'  WHERE name = 'DSP Equipment'   AND system_id = (SELECT id FROM systems WHERE name='Audio Visual');
UPDATE devices SET name = 'Control System' WHERE name = 'Control Systems' AND system_id = (SELECT id FROM systems WHERE name='Audio Visual');
UPDATE devices SET active = 0 WHERE name IN ('Displays', 'Speakers') AND system_id = (SELECT id FROM systems WHERE name='Audio Visual');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Audio Visual'), 'LCD Display',         'each', 2.50),
((SELECT id FROM systems WHERE name='Audio Visual'), 'LED Display',         'each', 3.00),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Video Wall Display',  'each', 4.00),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Interactive Display', 'each', 3.00),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Projection Screen',   'each', 2.00),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Ceiling Speaker',     'each', 0.75),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Surface Speaker',     'each', 0.75),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Pendant Speaker',     'each', 1.00),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Amplifier',           'each', 1.50),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Conference Camera',   'each', 1.50),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Microphone',          'each', 1.00),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Touch Panel',         'each', 1.50),
((SELECT id FROM systems WHERE name='Audio Visual'), 'Codec',               'each', 2.00);

-- ============ FIRE ALARM ============
UPDATE devices SET name = 'Smoke Detector'      WHERE name = 'Smoke Detectors'    AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Heat Detector'       WHERE name = 'Heat Detectors'     AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Beam Detector'       WHERE name = 'Beam Detectors'     AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Duct Detector'       WHERE name = 'Duct Detectors'     AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Pull Station'        WHERE name = 'Pull Stations'      AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Horn'                WHERE name = 'Horns'              AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Strobe'              WHERE name = 'Strobes'            AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Horn Strobe'         WHERE name = 'Horn/Strobes'       AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Monitor Module'      WHERE name = 'Monitor Modules'    AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Control Module'      WHERE name = 'Control Modules'    AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Power Supply'        WHERE name = 'Power Supplies'     AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Fire Alarm Panel'    WHERE name = 'Fire Alarm Panels'  AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Annunciator'         WHERE name = 'Annunciators'       AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Relay Module'        WHERE name = 'Relays'             AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');
UPDATE devices SET name = 'Aspirating Detector' WHERE name = 'Aspirating Systems' AND system_id = (SELECT id FROM systems WHERE name='Fire Alarm');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Waterflow Switch', 'each', 1.50),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Tamper Switch',    'each', 1.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Speaker',          'each', 1.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Speaker Strobe',   'each', 1.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Network Node',     'each', 4.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Voice Evac Panel', 'each', 8.00),
((SELECT id FROM systems WHERE name='Fire Alarm'), 'Isolator Module',  'each', 1.00);

-- ============ DATA CENTER (new) ============
INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Data Center'), 'Server Rack',              'each', 3.00),
((SELECT id FROM systems WHERE name='Data Center'), 'Cabinet',                  'each', 4.00),
((SELECT id FROM systems WHERE name='Data Center'), 'Ladder Rack',              'feet', 0.10),
((SELECT id FROM systems WHERE name='Data Center'), 'Cable Tray',               'feet', 0.06),
((SELECT id FROM systems WHERE name='Data Center'), 'UPS',                      'each', 3.00),
((SELECT id FROM systems WHERE name='Data Center'), 'PDU',                      'each', 1.00),
((SELECT id FROM systems WHERE name='Data Center'), 'RPP',                      'each', 4.00),
((SELECT id FROM systems WHERE name='Data Center'), 'Environmental Sensor',     'each', 1.00),
((SELECT id FROM systems WHERE name='Data Center'), 'Cooling Unit Monitor',     'each', 1.50),
((SELECT id FROM systems WHERE name='Data Center'), 'Core Switch',              'each', 4.00),
((SELECT id FROM systems WHERE name='Data Center'), 'Distribution Switch',      'each', 3.00),
((SELECT id FROM systems WHERE name='Data Center'), 'Fiber Distribution Shelf', 'each', 1.50);

-- ============ SPECIALTY ELECTRICAL / LOW VOLTAGE (new) ============
INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES
((SELECT id FROM systems WHERE name='Specialty Electrical / Low Voltage'), 'Clock',                  'each', 1.00),
((SELECT id FROM systems WHERE name='Specialty Electrical / Low Voltage'), 'Intercom Station',       'each', 1.50),
((SELECT id FROM systems WHERE name='Specialty Electrical / Low Voltage'), 'Paging Speaker',         'each', 1.00),
((SELECT id FROM systems WHERE name='Specialty Electrical / Low Voltage'), 'Master Station',         'each', 3.00),
((SELECT id FROM systems WHERE name='Specialty Electrical / Low Voltage'), 'Nurse Call Device',      'each', 1.25),
((SELECT id FROM systems WHERE name='Specialty Electrical / Low Voltage'), 'Area Of Refuge Station', 'each', 2.00),
((SELECT id FROM systems WHERE name='Specialty Electrical / Low Voltage'), 'Pull Box',               'each', 1.00),
((SELECT id FROM systems WHERE name='Specialty Electrical / Low Voltage'), 'Back Box',               'each', 0.50),
((SELECT id FROM systems WHERE name='Specialty Electrical / Low Voltage'), 'Conduit',                'feet', 0.08),
((SELECT id FROM systems WHERE name='Specialty Electrical / Low Voltage'), 'Junction Box',           'each', 0.75);

-- ============ CABLE TYPES (cable-pulling mode) ============
INSERT OR IGNORE INTO cable_types (name) VALUES
('Shielded Cat6A'),
('6 Strand Fiber'),
('12 Strand Fiber'),
('24 Strand Fiber'),
('48 Strand Fiber'),
('96 Strand Fiber'),
('144 Strand Fiber');
