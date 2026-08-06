import express from 'express';
import pool from '../src/config/database.js';
import { authenticateToken, authorizeRoles } from '../src/middleware/auth.js';

const router = express.Router();

router.get('/employee', authenticateToken, authorizeRoles('employee'), async (req, res) => {
  try {
    const userId = req.user.id;
    const [assets, gatePasses, openReports, pendingRequests] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM asset_assignments WHERE assigned_to = $1 AND status = 'active'", [userId]),
      pool.query("SELECT COUNT(*) FROM gate_passes WHERE employee_id = $1 AND status IN ('pending_head','pending_owner_dept','pending_inventory','pending_procurement','active')", [userId]),
      pool.query("SELECT COUNT(*) FROM issue_reports WHERE reported_by = $1 AND status NOT IN ('resolved','rejected')", [userId]),
      pool.query("SELECT COUNT(*) FROM asset_requests WHERE assigned_to = $1 AND status IN ('pending_owner_dept','pending_dept_assignment','pending_inventory','pending_procurement','partially_fulfilled')", [userId]),
    ]);
    res.json({
      assigned_assets: parseInt(assets.rows[0].count),
      pending_requests: parseInt(pendingRequests.rows[0].count),
      active_gate_passes: parseInt(gatePasses.rows[0].count),
      issue_reports: parseInt(openReports.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/head', authenticateToken, authorizeRoles('head'), async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await pool.query('SELECT department_id FROM users WHERE id = $1', [userId]);
    const departmentId = userResult.rows[0].department_id;

    const [assets, gatePasses, ownerGatePasses, ownerRequests, ownerReports, reports, employees, deptRequests, fulfilledRequests, deptAssignment] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM asset_assignments WHERE department_id = $1 AND status = 'active'", [departmentId]),
      pool.query(`SELECT COUNT(*) FROM gate_passes gp JOIN users u ON gp.employee_id = u.id WHERE u.department_id = $1 AND gp.status = 'pending_head'`, [departmentId]),
      pool.query(`SELECT COUNT(*) FROM gate_passes gp JOIN assets a ON gp.asset_id = a.id JOIN asset_categories ac ON a.category_id = ac.id WHERE gp.status = 'pending_owner_dept' AND ac.specialist_department_id = $1`, [departmentId]),
      pool.query(`SELECT COUNT(DISTINCT ar.id) FROM asset_requests ar JOIN asset_request_items ari ON ar.id = ari.request_id JOIN asset_categories ac ON ari.category_id = ac.id WHERE ar.status = 'pending_owner_dept' AND ac.specialist_department_id = $1 AND NOT EXISTS (SELECT 1 FROM asset_request_owner_approvals oa WHERE oa.request_id = ar.id AND oa.owner_department_id = $1)`, [departmentId]),
      pool.query(`SELECT COUNT(*) FROM issue_reports ir JOIN assets a ON ir.asset_id = a.id JOIN asset_categories ac ON a.category_id = ac.id WHERE ir.status = 'pending_owner_dept' AND ac.specialist_department_id = $1`, [departmentId]),
      pool.query(`SELECT COUNT(*) FROM issue_reports ir JOIN users u ON ir.reported_by = u.id WHERE u.department_id = $1 AND ir.status = 'pending_head'`, [departmentId]),
      pool.query('SELECT COUNT(*) FROM users WHERE department_id = $1 AND is_active = true', [departmentId]),
      pool.query("SELECT COUNT(*) FROM asset_requests WHERE department_id = $1 AND status IN ('pending_owner_dept','pending_dept_assignment','pending_inventory','pending_procurement')", [departmentId]),
      pool.query("SELECT COUNT(*) FROM asset_requests WHERE department_id = $1 AND status IN ('fulfilled','partially_fulfilled')", [departmentId]),
      pool.query(`SELECT COUNT(DISTINCT ar.id) FROM asset_requests ar JOIN asset_request_items ari ON ar.id = ari.request_id JOIN asset_categories ac ON ari.category_id = ac.id WHERE ar.status = 'pending_dept_assignment' AND ac.specialist_department_id = $1`, [departmentId]),
    ]);

    res.json({
      department_assets: parseInt(assets.rows[0].count),
      pending_gate_passes: parseInt(gatePasses.rows[0].count),
      pending_owner_gate_passes: parseInt(ownerGatePasses.rows[0].count),
      pending_owner_requests: parseInt(ownerRequests.rows[0].count),
      pending_owner_reports: parseInt(ownerReports.rows[0].count),
      pending_reports: parseInt(reports.rows[0].count),
      department_employees: parseInt(employees.rows[0].count),
      pending_dept_requests: parseInt(deptRequests.rows[0].count),
      fulfilled_requests: parseInt(fulfilledRequests.rows[0].count),
      pending_dept_assignment: parseInt(deptAssignment.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/inventory', authenticateToken, authorizeRoles('inventory'), async (req, res) => {
  try {
    const [total, available, assigned, requests, gatePasses, reports, lowStock, fulfilled] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM assets'),
      pool.query("SELECT COUNT(*) FROM assets WHERE status = 'available'"),
      pool.query("SELECT COUNT(*) FROM assets WHERE status = 'assigned'"),
      pool.query("SELECT COUNT(*) FROM asset_requests WHERE status IN ('pending_inventory','pending_procurement')"),
      pool.query("SELECT COUNT(*) FROM gate_passes WHERE status IN ('pending_inventory','pending_procurement')"),
      pool.query("SELECT COUNT(*) FROM issue_reports WHERE status IN ('pending_inventory','pending_procurement')"),
      pool.query("SELECT COUNT(*) FROM assets WHERE condition IN ('fair','poor') AND status = 'available'"),
      pool.query("SELECT COUNT(*) FROM asset_requests WHERE status IN ('fulfilled','partially_fulfilled') AND fulfilled_at > NOW() - INTERVAL '30 days'"),
    ]);
    res.json({
      total_assets: parseInt(total.rows[0].count),
      available_assets: parseInt(available.rows[0].count),
      assigned_assets: parseInt(assigned.rows[0].count),
      pending_requests: parseInt(requests.rows[0].count),
      pending_gate_passes: parseInt(gatePasses.rows[0].count),
      pending_reports: parseInt(reports.rows[0].count),
      low_stock_alerts: parseInt(lowStock.rows[0].count),
      fulfilled_requests: parseInt(fulfilled.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/procurement', authenticateToken, authorizeRoles('inventory'), async (req, res, next) => {
  req.url = '/inventory';
  router.handle(req, res, next);
});

router.get('/hse', authenticateToken, authorizeRoles('hse'), async (req, res) => {
  try {
    const [pending, resolved] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM issue_reports WHERE status = 'pending_hse'"),
      pool.query("SELECT COUNT(*) FROM issue_reports WHERE status IN ('resolved','rejected') AND EXISTS (SELECT 1 FROM issue_timeline it WHERE it.issue_report_id = issue_reports.id AND it.actor_role = 'hse')"),
    ]);
    res.json({
      pending_reviews: parseInt(pending.rows[0].count),
      reviewed_total: parseInt(resolved.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/hr', authenticateToken, authorizeRoles('hr'), async (req, res) => {
  try {
    const [depts, employees, active, inactive] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM departments'),
      pool.query("SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name IN ('employee','head','hr','inventory','hse')"),
      pool.query('SELECT COUNT(*) FROM users WHERE is_active = true'),
      pool.query('SELECT COUNT(*) FROM users WHERE is_active = false'),
    ]);
    res.json({
      total_departments: parseInt(depts.rows[0].count),
      total_staff: parseInt(employees.rows[0].count),
      active_users: parseInt(active.rows[0].count),
      inactive_users: parseInt(inactive.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
