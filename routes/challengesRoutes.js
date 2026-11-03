import express from "express";
import challengesController from "../controllers/challengesController.js";
import verifyToken from "../middleware/authMiddleware.js";
import { checkRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, challengesController.obtenerRetos);
router.get("/dificultades", verifyToken, challengesController.obtenerDificultades);
router.get("/:id", verifyToken, challengesController.obtenerReto);
router.post("/", verifyToken, checkRole("admin", "docente"), challengesController.crearReto);
router.put("/:id", verifyToken, challengesController.actualizarReto);
router.delete("/:id", verifyToken, challengesController.eliminarReto);
router.post("/:id/save", verifyToken, challengesController.alternarGuardado);

export default router;
