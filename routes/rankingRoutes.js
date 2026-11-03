import express from "express";
import rankingController from "../controllers/rankingController.js";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", rankingController.obtenerRanking);
router.get("/medallas", rankingController.obtenerMedallas);
router.get("/logros", rankingController.obtenerLogros);
router.get("/resumen", rankingController.obtenerResumen);

export default router;
