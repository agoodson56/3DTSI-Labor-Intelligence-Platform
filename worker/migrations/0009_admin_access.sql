-- Migration 0009: tighten admin-area access.
-- Projects + Catalog management: Admin, Project Manager, Superintendent, Lead Technician.
-- Users + Roles management: Administrator only (drop users.view elsewhere).

UPDATE roles SET permissions = '["dashboard.view","intelligence.view","reports.view","projects.view","projects.manage","customers.manage","catalog.manage","sessions.view_all","sessions.create"]'
WHERE name = 'Project Manager';

UPDATE roles SET permissions = '["dashboard.view","intelligence.view","reports.view","projects.view","projects.manage","customers.manage","catalog.manage","sessions.view_all","sessions.create"]'
WHERE name = 'Superintendent';

UPDATE roles SET permissions = '["projects.view","projects.manage","customers.manage","catalog.manage","sessions.create","sessions.view_own"]'
WHERE name = 'Lead Technician';

UPDATE roles SET permissions = '["dashboard.view","intelligence.view","reports.view","projects.view","sessions.view_all","sessions.create"]'
WHERE name = 'Operations Manager';

UPDATE roles SET permissions = '["dashboard.view","intelligence.view","reports.view","projects.view","sessions.view_all"]'
WHERE name = 'Executive';
