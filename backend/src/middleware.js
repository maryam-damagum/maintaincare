
const prisma = require("./db");

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      message: "Please log in to continue.",
    });
  }

  next();
}

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          message: "Please log in to continue.",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { id: true, role: true },
      });

      if (!user) {
        return res.status(401).json({
          message: "Your session is invalid. Please log in again.",
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          message: "You do not have permission to perform this action.",
        });
      }

      req.currentUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { requireAuth, requireRole };
