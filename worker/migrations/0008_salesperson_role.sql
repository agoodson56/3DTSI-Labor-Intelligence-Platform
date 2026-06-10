-- Migration 0008: Salesperson role - read-only visibility into production
-- rates, reports, dashboards, and projects to support quoting and customer
-- conversations. Permissions are adjustable in Admin -> Roles.
INSERT OR IGNORE INTO roles (name, description, permissions, is_system) VALUES
('Salesperson', 'Sales - production rates, reports, and project visibility for quoting', '["dashboard.view","intelligence.view","reports.view","projects.view"]', 1);
