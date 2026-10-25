function requireLogin(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/login');
}

function requireSuperAdmin(req, res, next) {
  if (req.session && req.session.isSuperAdmin) {
    return next();
  }
  return res.redirect('/');
}

module.exports = { requireLogin, requireSuperAdmin };
