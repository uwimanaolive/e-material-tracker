import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    let role = req.user.role === 'specialist' ? 'head' : req.user.role;
    // Legacy procurement JWT → inventory
    if (role === 'procurement') role = 'inventory';
    const expanded = roles.flatMap((r) => {
      if (r === 'head') return ['head', 'specialist'];
      if (r === 'inventory') return ['inventory', 'procurement'];
      return [r];
    });
    const userRole = req.user.role === 'procurement' ? 'inventory' : req.user.role;
    if (!expanded.includes(role) && !expanded.includes(userRole) && !expanded.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
