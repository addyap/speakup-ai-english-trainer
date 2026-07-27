import { Router, type IRouter } from "express";
import healthRouter from "./health";
import trainerRouter from "./trainer";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/trainer", trainerRouter);

export default router;
