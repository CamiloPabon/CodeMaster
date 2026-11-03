import express from "express";
import coursesController from "../controllers/coursesController.js";
import verifyToken from "../middleware/authMiddleware.js";
import { checkRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", coursesController.obtenerCursos);
router.post("/", checkRole("admin", "docente"), coursesController.crearCurso);
router.get("/:id", coursesController.obtenerCurso);
router.delete("/:id", coursesController.eliminarCurso);
router.post("/:id/join", coursesController.unirse);
router.delete("/:id/join", coursesController.salir);
router.post("/:id/like", coursesController.alternarLike);
router.post("/:id/save", coursesController.alternarGuardado);
router.post("/:id/comments", coursesController.comentar);
router.delete("/:id/comments/:comentarioId", coursesController.eliminarComentario);
router.post("/:id/challenges", coursesController.agregarReto);
router.delete("/:id/challenges/:retoId", coursesController.quitarReto);

export default router;
