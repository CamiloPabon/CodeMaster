import express from "express";
import compilerController from "../controllers/compilerController.js";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/languages", verifyToken, compilerController.obtenerLenguajes);
router.post("/run", verifyToken, compilerController.ejecutarCodigo);
router.post("/submit", verifyToken, compilerController.enviarSolucion);

export default router;
