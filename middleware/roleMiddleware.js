const checkAdmin = (req, res, next) => {
  if (req.user.rol !== "admin") {
    return res.status(403).json({ error: "Acceso solo para admin" });
  }
  next();
};

// Permite el acceso solo a los roles indicados, ej: checkRole("admin", "docente")
export const checkRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.rol)) {
    return res.status(403).json({ error: "No tienes permiso para esta acción" });
  }
  next();
};

export default checkAdmin;