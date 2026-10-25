import { Router, type IRouter } from "express";
import healthRouter from "./health";
import irisRouter from "./iris";

const router: IRouter = Router();

router.use(healthRouter);
router.use(irisRouter);

export default router;
