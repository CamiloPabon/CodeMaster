import express from "express";
import usuariosController from "../controllers/usuariosController.js";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, usuariosController.obtenerUsuarios);
router.post("/", verifyToken, usuariosController.crearUsuario);
router.put("/:id", verifyToken, usuariosController.actualizarUsuario);
router.delete("/:id", verifyToken, usuariosController.eliminarUsuario);

export default router;