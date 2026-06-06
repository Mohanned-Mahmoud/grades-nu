import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gradesRouter from "./grades";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/grades", gradesRouter);

export default router;
