import express from "express";
import usuariosController from "../controllers/usuariosController.js";
import verifyToken from "../middleware/authMiddleware.js";
import checkAdmin from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, usuariosController.obtenerUsuarios);
router.post("/", verifyToken, checkAdmin, usuariosController.crearUsuario);
router.put("/:id", verifyToken, checkAdmin, usuariosController.actualizarUsuario);
router.delete("/:id", verifyToken, checkAdmin, usuariosController.eliminarUsuario);

export default router;