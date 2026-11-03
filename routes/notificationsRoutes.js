import express from "express";
import notificationsController from "../controllers/notificationsController.js";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", notificationsController.obtenerNotificaciones);
router.post("/read", notificationsController.marcarLeidas);

export default router;
