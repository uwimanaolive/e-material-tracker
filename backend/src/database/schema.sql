-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS issue_timeline CASCADE;
DROP TABLE IF EXISTS issue_reports CASCADE;
DROP TABLE IF EXISTS asset_movements CASCADE;
DROP TABLE IF EXISTS gate_pass_timeline CASCADE;
DROP TABLE IF EXISTS gate_passes CASCADE;
DROP TABLE IF EXISTS assignment_history CASCADE;
DROP TABLE IF EXISTS asset_assignments CASCADE;
DROP TABLE IF EXISTS request_timeline CASCADE;
DROP TABLE IF EXISTS asset_request_items CASCADE;
DROP TABLE IF EXISTS asset_requests CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS asset_categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- Departments table
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles table
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  role_id INTEGER REFERENCES roles(id),
  department_id INTEGER REFERENCES departments(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Asset categories table
CREATE TABLE asset_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  specialist_department_id INTEGER REFERENCES departments(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assets table
CREATE TABLE assets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category_id INTEGER REFERENCES asset_categories(id),
  serial_number VARCHAR(100) UNIQUE,
  model VARCHAR(100),
  brand VARCHAR(100),
  purchase_date DATE,
  purchase_cost DECIMAL(10, 2),
  current_location VARCHAR(100),
  store_department_id INTEGER REFERENCES departments(id),
  status VARCHAR(50) DEFAULT 'available',
  condition VARCHAR(50) DEFAULT 'good',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Department category access (which categories a department can request from store)
CREATE TABLE department_categories (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES asset_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(department_id, category_id)
);

-- Inventory transactions table
CREATE TABLE inventory_transactions (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER REFERENCES assets(id),
  transaction_type VARCHAR(50) NOT NULL,
  quantity INTEGER DEFAULT 1,
  from_location VARCHAR(100),
  to_location VARCHAR(100),
  performed_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Asset requests table
CREATE TABLE asset_requests (
  id SERIAL PRIMARY KEY,
  request_number VARCHAR(50) UNIQUE NOT NULL,
  requested_by INTEGER REFERENCES users(id),
  department_id INTEGER REFERENCES departments(id),
  assigned_to INTEGER REFERENCES users(id),
  justification TEXT,
  urgency VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'pending_head',
  fulfilled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Asset request items table
CREATE TABLE asset_request_items (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES asset_requests(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES asset_categories(id),
  asset_id INTEGER REFERENCES assets(id),
  quantity INTEGER NOT NULL,
  specifications TEXT,
  fulfilled_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Owner department approvals for cross-dept requests
CREATE TABLE asset_request_owner_approvals (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES asset_requests(id) ON DELETE CASCADE,
  owner_department_id INTEGER NOT NULL REFERENCES departments(id),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  UNIQUE(request_id, owner_department_id)
);

-- Request timeline table
CREATE TABLE request_timeline (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES asset_requests(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id),
  actor_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Asset assignments table
CREATE TABLE asset_assignments (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER REFERENCES assets(id),
  assigned_to INTEGER REFERENCES users(id),
  assigned_by INTEGER REFERENCES users(id),
  department_id INTEGER REFERENCES departments(id),
  request_id INTEGER REFERENCES asset_requests(id),
  request_item_id INTEGER REFERENCES asset_request_items(id),
  assigned_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assignment history table
CREATE TABLE assignment_history (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER REFERENCES asset_assignments(id),
  asset_id INTEGER REFERENCES assets(id),
  from_user INTEGER REFERENCES users(id),
  to_user INTEGER REFERENCES users(id),
  performed_by INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gate passes table
CREATE TABLE gate_passes (
  id SERIAL PRIMARY KEY,
  gate_pass_number VARCHAR(50) UNIQUE NOT NULL,
  asset_id INTEGER REFERENCES assets(id),
  employee_id INTEGER REFERENCES users(id),
  from_location VARCHAR(100) NOT NULL,
  to_location VARCHAR(100) NOT NULL,
  reason TEXT NOT NULL,
  departure_date DATE NOT NULL,
  expected_return_date DATE,
  actual_return_date DATE,
  status VARCHAR(50) DEFAULT 'pending_head',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gate pass timeline table
CREATE TABLE gate_pass_timeline (
  id SERIAL PRIMARY KEY,
  gate_pass_id INTEGER REFERENCES gate_passes(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id),
  actor_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Asset movements table
CREATE TABLE asset_movements (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER REFERENCES assets(id),
  gate_pass_id INTEGER REFERENCES gate_passes(id),
  from_location VARCHAR(100),
  to_location VARCHAR(100),
  moved_by INTEGER REFERENCES users(id),
  movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- Issue reports table
CREATE TABLE issue_reports (
  id SERIAL PRIMARY KEY,
  report_number VARCHAR(50) UNIQUE NOT NULL,
  asset_id INTEGER REFERENCES assets(id),
  reported_by INTEGER REFERENCES users(id),
  issue_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  attachment VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending_head',
  resolution_outcome VARCHAR(50),
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Issue timeline table
CREATE TABLE issue_timeline (
  id SERIAL PRIMARY KEY,
  issue_report_id INTEGER REFERENCES issue_reports(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id),
  actor_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50),
  is_read BOOLEAN DEFAULT false,
  related_entity_type VARCHAR(50),
  related_entity_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_assets_category ON assets(category_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_requests_requested_by ON asset_requests(requested_by);
CREATE INDEX idx_requests_department ON asset_requests(department_id);
CREATE INDEX idx_requests_status ON asset_requests(status);
CREATE INDEX idx_assignments_asset ON asset_assignments(asset_id);
CREATE INDEX idx_assignments_user ON asset_assignments(assigned_to);
CREATE INDEX idx_assignments_department ON asset_assignments(department_id);
CREATE INDEX idx_gate_passes_employee ON gate_passes(employee_id);
CREATE INDEX idx_gate_passes_status ON gate_passes(status);
CREATE INDEX idx_issue_reports_asset ON issue_reports(asset_id);
CREATE INDEX idx_issue_reports_reported_by ON issue_reports(reported_by);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
