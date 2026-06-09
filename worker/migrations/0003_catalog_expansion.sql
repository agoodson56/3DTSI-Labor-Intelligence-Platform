-- Migration 0003: full 3DTSI device taxonomy (manufacturer-agnostic, device level)
-- Strategy: rename 1:1 matches to preserve recorded labor history, deactivate
-- superseded generics, add new systems and devices. estimate_hours_per_unit
-- values are starting points - tune them in Admin -> Catalog.

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
-- superseded by Fiber Optic Systems strand-count cables
UPDATE devices SET active = 0 WHERE name = 'Fiber' AND system_id = (SELECT id FROM systems WHERE name='Structured Cabling');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit)
SELECT id, 'Shielded Cat6A Cable', 'feet', 0.014 FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'Plenum Cable',         'feet', 0.012 FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'Non-Plenum Cable',     'feet', 0.010 FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'RJ45 Jack',            'each', 0.15  FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'Surface Mount Box',    'each', 0.25  FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'Biscuit Jack',         'each', 0.20  FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'Patch Panel Port',     'each', 0.10  FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'J-Hook',               'each', 0.08  FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'Cable Tray',           'feet', 0.06  FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'Conduit',              'feet', 0.08  FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'Innerduct',            'feet', 0.03  FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'Raceway',              'feet', 0.06  FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'Ladder Rack',          'feet', 0.10  FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'Vertical Wire Manager','each', 0.50  FROM systems WHERE name='Structured Cabling' UNION ALL
SELECT id, 'Horizontal Wire Manager','each', 0.30 FROM systems WHERE name='Structured Cabling';

-- ============ FIBER OPTIC SYSTEMS ============
UPDATE devices SET name = 'Fiber Enclosure'   WHERE name = 'Splice Enclosures' AND system_id = (SELECT id FROM systems WHERE name='Fiber Optic Systems');
UPDATE devices SET name = 'Fiber Patch Panel' WHERE name = 'Fiber Panels'      AND system_id = (SELECT id FROM systems WHERE name='Fiber Optic Systems');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit)
SELECT id, '6 Strand Fiber',    'feet', 0.010 FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, '12 Strand Fiber',   'feet', 0.011 FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, '24 Strand Fiber',   'feet', 0.012 FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, '48 Strand Fiber',   'feet', 0.014 FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, '96 Strand Fiber',   'feet', 0.016 FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, '144 Strand Fiber',  'feet', 0.018 FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, 'LC Connector',      'each', 0.25  FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, 'SC Connector',      'each', 0.25  FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, 'ST Connector',      'each', 0.25  FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, 'Fiber Shelf',       'each', 1.00  FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, 'Fiber Cassette',    'each', 0.50  FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, 'Media Converter',   'each', 0.75  FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, 'Fiber Transceiver', 'each', 0.25  FROM systems WHERE name='Fiber Optic Systems' UNION ALL
SELECT id, 'Fiber Splice Tray', 'each', 1.00  FROM systems WHERE name='Fiber Optic Systems';

-- ============ ACCESS CONTROL ============
UPDATE devices SET name = 'Card Reader'           WHERE name = 'Card Readers'     AND system_id = (SELECT id FROM systems WHERE name='Access Control');
UPDATE devices SET name = 'Maglock'               WHERE name = 'Mag Locks'        AND system_id = (SELECT id FROM systems WHERE name='Access Control');
UPDATE devices SET name = 'Electric Strike'       WHERE name = 'Electric Strikes' AND system_id = (SELECT id FROM systems WHERE name='Access Control');
UPDATE devices SET name = 'Door Contact'          WHERE name = 'Door Contacts'    AND system_id = (SELECT id FROM systems WHERE name='Access Control');
UPDATE devices SET name = 'Request To Exit (REX)' WHERE name = 'REX Devices'      AND system_id = (SELECT id FROM systems WHERE name='Access Control');
UPDATE devices SET name = 'Power Supply'          WHERE name = 'Power Supplies'   AND system_id = (SELECT id FROM systems WHERE name='Access Control');
-- superseded: generic panels -> door controllers; motion sensors -> Motion REX / Intrusion
UPDATE devices SET active = 0 WHERE name IN ('Panels', 'Motion Sensors') AND system_id = (SELECT id FROM systems WHERE name='Access Control');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit)
SELECT id, 'Keypad Reader',              'each', 2.50 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Mullion Reader',             'each', 2.80 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Biometric Reader',           'each', 3.50 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Electrified Lever Set',      'each', 4.00 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Electrified Panic Hardware', 'each', 5.00 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Door Operator',              'each', 6.00 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Motion REX',                 'each', 1.25 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Push Button REX',            'each', 1.00 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Single Door Controller',     'each', 4.00 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Two Door Controller',        'each', 5.00 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Four Door Controller',       'each', 6.00 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Intelligent Controller',     'each', 8.00 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Card',                       'each', 0.02 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Fob',                        'each', 0.02 FROM systems WHERE name='Access Control' UNION ALL
SELECT id, 'Mobile Credential',          'each', 0.05 FROM systems WHERE name='Access Control';

-- ============ CCTV / VIDEO SURVEILLANCE ============
UPDATE devices SET name = 'PTZ Camera'          WHERE name = 'PTZ Cameras'          AND system_id = (SELECT id FROM systems WHERE name='CCTV / Video Surveillance');
UPDATE devices SET name = 'Multi-Sensor Camera' WHERE name = 'Multi-Sensor Cameras' AND system_id = (SELECT id FROM systems WHERE name='CCTV / Video Surveillance');
UPDATE devices SET name = 'Video Server'        WHERE name = 'Servers'              AND system_id = (SELECT id FROM systems WHERE name='CCTV / Video Surveillance');
UPDATE devices SET name = 'Monitor'             WHERE name = 'Monitors'             AND system_id = (SELECT id FROM systems WHERE name='CCTV / Video Surveillance');
-- superseded: split into dome/bullet, mounts, and AV video walls
UPDATE devices SET active = 0 WHERE name IN ('Fixed Cameras', 'Pole Cameras', 'Video Walls', 'Analytics Devices') AND system_id = (SELECT id FROM systems WHERE name='CCTV / Video Surveillance');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit)
SELECT id, 'Fixed Dome Camera',   'each', 1.75 FROM systems WHERE name='CCTV / Video Surveillance' UNION ALL
SELECT id, 'Fixed Bullet Camera', 'each', 1.75 FROM systems WHERE name='CCTV / Video Surveillance' UNION ALL
SELECT id, 'Fisheye Camera',      'each', 2.00 FROM systems WHERE name='CCTV / Video Surveillance' UNION ALL
SELECT id, 'Thermal Camera',      'each', 2.50 FROM systems WHERE name='CCTV / Video Surveillance' UNION ALL
SELECT id, 'LPR Camera',          'each', 3.00 FROM systems WHERE name='CCTV / Video Surveillance' UNION ALL
SELECT id, 'DVR',                 'each', 3.00 FROM systems WHERE name='CCTV / Video Surveillance' UNION ALL
SELECT id, 'Storage Array',       'each', 4.00 FROM systems WHERE name='CCTV / Video Surveillance' UNION ALL
SELECT id, 'Camera Mount',        'each', 0.50 FROM systems WHERE name='CCTV / Video Surveillance' UNION ALL
SELECT id, 'Pole Mount',          'each', 2.00 FROM systems WHERE name='CCTV / Video Surveillance' UNION ALL
SELECT id, 'Corner Mount',        'each', 1.00 FROM systems WHERE name='CCTV / Video Surveillance' UNION ALL
SELECT id, 'Housing',             'each', 0.75 FROM systems WHERE name='CCTV / Video Surveillance' UNION ALL
SELECT id, 'Heater Blower Kit',   'each', 0.75 FROM systems WHERE name='CCTV / Video Surveillance';

-- ============ INTRUSION DETECTION (new) ============
INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit)
SELECT id, 'Door Contact',           'each', 0.75 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Window Contact',         'each', 0.75 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Glass Break Detector',   'each', 1.00 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Motion Detector',        'each', 1.00 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Dual Technology Motion', 'each', 1.00 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Beam Detector',          'each', 3.00 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Panic Button',           'each', 0.75 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Intrusion Panel',        'each', 4.00 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Keypad',                 'each', 1.00 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Expansion Module',       'each', 1.00 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Communicator',           'each', 1.50 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Siren',                  'each', 1.00 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Strobe',                 'each', 1.00 FROM systems WHERE name='Intrusion Detection' UNION ALL
SELECT id, 'Sounder',                'each', 1.00 FROM systems WHERE name='Intrusion Detection';

-- ============ NETWORKING ============
UPDATE devices SET name = 'Router'             WHERE name = 'Routers'             AND system_id = (SELECT id FROM systems WHERE name='Networking');
UPDATE devices SET name = 'Firewall'           WHERE name = 'Firewalls'           AND system_id = (SELECT id FROM systems WHERE name='Networking');
UPDATE devices SET name = 'Network Controller' WHERE name = 'Network Controllers' AND system_id = (SELECT id FROM systems WHERE name='Networking');
-- superseded: split by switch class and AP location
UPDATE devices SET active = 0 WHERE name IN ('Switches', 'Wireless Access Points') AND system_id = (SELECT id FROM systems WHERE name='Networking');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit)
SELECT id, 'Layer 2 Switch',       'each', 2.00 FROM systems WHERE name='Networking' UNION ALL
SELECT id, 'Layer 3 Switch',       'each', 2.50 FROM systems WHERE name='Networking' UNION ALL
SELECT id, 'PoE Switch',           'each', 2.00 FROM systems WHERE name='Networking' UNION ALL
SELECT id, 'Industrial Switch',    'each', 2.50 FROM systems WHERE name='Networking' UNION ALL
SELECT id, 'Indoor Access Point',  'each', 1.50 FROM systems WHERE name='Networking' UNION ALL
SELECT id, 'Outdoor Access Point', 'each', 3.00 FROM systems WHERE name='Networking' UNION ALL
SELECT id, 'Wireless Bridge',      'each', 3.00 FROM systems WHERE name='Networking' UNION ALL
SELECT id, 'Antenna',              'each', 1.50 FROM systems WHERE name='Networking' UNION ALL
SELECT id, 'VPN Appliance',        'each', 3.00 FROM systems WHERE name='Networking' UNION ALL
SELECT id, 'UPS',                  'each', 2.00 FROM systems WHERE name='Networking' UNION ALL
SELECT id, 'PDU',                  'each', 1.00 FROM systems WHERE name='Networking' UNION ALL
SELECT id, 'Network Rack',         'each', 3.00 FROM systems WHERE name='Networking' UNION ALL
SELECT id, 'Network Cabinet',      'each', 4.00 FROM systems WHERE name='Networking';

-- ============ AUDIO VISUAL ============
UPDATE devices SET name = 'Projector'      WHERE name = 'Projectors'     AND system_id = (SELECT id FROM systems WHERE name='Audio Visual');
UPDATE devices SET name = 'DSP Processor'  WHERE name = 'DSP Equipment'  AND system_id = (SELECT id FROM systems WHERE name='Audio Visual');
UPDATE devices SET name = 'Control System' WHERE name = 'Control Systems' AND system_id = (SELECT id FROM systems WHERE name='Audio Visual');
-- superseded: split by display/speaker type
UPDATE devices SET active = 0 WHERE name IN ('Displays', 'Speakers') AND system_id = (SELECT id FROM systems WHERE name='Audio Visual');

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit)
SELECT id, 'LCD Display',         'each', 2.50 FROM systems WHERE name='Audio Visual' UNION ALL
SELECT id, 'LED Display',         'each', 3.00 FROM systems WHERE name='Audio Visual' UNION ALL
SELECT id, 'Video Wall Display',  'each', 4.00 FROM systems WHERE name='Audio Visual' UNION ALL
SELECT id, 'Interactive Display', 'each', 3.00 FROM systems WHERE name='Audio Visual' UNION ALL
SELECT id, 'Projection Screen',   'each', 2.00 FROM systems WHERE name='Audio Visual' UNION ALL
SELECT id, 'Ceiling Speaker',     'each', 0.75 FROM systems WHERE name='Audio Visual' UNION ALL
SELECT id, 'Surface Speaker',     'each', 0.75 FROM systems WHERE name='Audio Visual' UNION ALL
SELECT id, 'Pendant Speaker',     'each', 1.00 FROM systems WHERE name='Audio Visual' UNION ALL
SELECT id, 'Amplifier',           'each', 1.50 FROM systems WHERE name='Audio Visual' UNION ALL
SELECT id, 'Conference Camera',   'each', 1.50 FROM systems WHERE name='Audio Visual' UNION ALL
SELECT id, 'Microphone',          'each', 1.00 FROM systems WHERE name='Audio Visual' UNION ALL
SELECT id, 'Touch Panel',         'each', 1.50 FROM systems WHERE name='Audio Visual' UNION ALL
SELECT id, 'Codec',               'each', 2.00 FROM systems WHERE name='Audio Visual';

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

INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit)
SELECT id, 'Waterflow Switch', 'each', 1.50 FROM systems WHERE name='Fire Alarm' UNION ALL
SELECT id, 'Tamper Switch',    'each', 1.00 FROM systems WHERE name='Fire Alarm' UNION ALL
SELECT id, 'Speaker',          'each', 1.00 FROM systems WHERE name='Fire Alarm' UNION ALL
SELECT id, 'Speaker Strobe',   'each', 1.00 FROM systems WHERE name='Fire Alarm' UNION ALL
SELECT id, 'Network Node',     'each', 4.00 FROM systems WHERE name='Fire Alarm' UNION ALL
SELECT id, 'Voice Evac Panel', 'each', 8.00 FROM systems WHERE name='Fire Alarm' UNION ALL
SELECT id, 'Isolator Module',  'each', 1.00 FROM systems WHERE name='Fire Alarm';

-- ============ DATA CENTER (new) ============
INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit)
SELECT id, 'Server Rack',              'each', 3.00 FROM systems WHERE name='Data Center' UNION ALL
SELECT id, 'Cabinet',                  'each', 4.00 FROM systems WHERE name='Data Center' UNION ALL
SELECT id, 'Ladder Rack',              'feet', 0.10 FROM systems WHERE name='Data Center' UNION ALL
SELECT id, 'Cable Tray',               'feet', 0.06 FROM systems WHERE name='Data Center' UNION ALL
SELECT id, 'UPS',                      'each', 3.00 FROM systems WHERE name='Data Center' UNION ALL
SELECT id, 'PDU',                      'each', 1.00 FROM systems WHERE name='Data Center' UNION ALL
SELECT id, 'RPP',                      'each', 4.00 FROM systems WHERE name='Data Center' UNION ALL
SELECT id, 'Environmental Sensor',     'each', 1.00 FROM systems WHERE name='Data Center' UNION ALL
SELECT id, 'Cooling Unit Monitor',     'each', 1.50 FROM systems WHERE name='Data Center' UNION ALL
SELECT id, 'Core Switch',              'each', 4.00 FROM systems WHERE name='Data Center' UNION ALL
SELECT id, 'Distribution Switch',      'each', 3.00 FROM systems WHERE name='Data Center' UNION ALL
SELECT id, 'Fiber Distribution Shelf', 'each', 1.50 FROM systems WHERE name='Data Center';

-- ============ SPECIALTY ELECTRICAL / LOW VOLTAGE (new) ============
INSERT OR IGNORE INTO devices (system_id, name, unit, estimate_hours_per_unit)
SELECT id, 'Clock',                  'each', 1.00 FROM systems WHERE name='Specialty Electrical / Low Voltage' UNION ALL
SELECT id, 'Intercom Station',       'each', 1.50 FROM systems WHERE name='Specialty Electrical / Low Voltage' UNION ALL
SELECT id, 'Paging Speaker',         'each', 1.00 FROM systems WHERE name='Specialty Electrical / Low Voltage' UNION ALL
SELECT id, 'Master Station',         'each', 3.00 FROM systems WHERE name='Specialty Electrical / Low Voltage' UNION ALL
SELECT id, 'Nurse Call Device',      'each', 1.25 FROM systems WHERE name='Specialty Electrical / Low Voltage' UNION ALL
SELECT id, 'Area Of Refuge Station', 'each', 2.00 FROM systems WHERE name='Specialty Electrical / Low Voltage' UNION ALL
SELECT id, 'Pull Box',               'each', 1.00 FROM systems WHERE name='Specialty Electrical / Low Voltage' UNION ALL
SELECT id, 'Back Box',               'each', 0.50 FROM systems WHERE name='Specialty Electrical / Low Voltage' UNION ALL
SELECT id, 'Conduit',                'feet', 0.08 FROM systems WHERE name='Specialty Electrical / Low Voltage' UNION ALL
SELECT id, 'Junction Box',           'each', 0.75 FROM systems WHERE name='Specialty Electrical / Low Voltage';

-- ============ CABLE TYPES (cable-pulling mode) ============
INSERT OR IGNORE INTO cable_types (name) VALUES
('Shielded Cat6A'),
('6 Strand Fiber'),
('12 Strand Fiber'),
('24 Strand Fiber'),
('48 Strand Fiber'),
('96 Strand Fiber'),
('144 Strand Fiber');
