import { Router} from 'express';
import { cmcdRequest } from './cmcd.controller.js';

const router = Router();

router.get("/response-mode", (req, res)=>{cmcdRequest(req, res, "response")} );
router.post("/response-mode", (req, res)=>{cmcdRequest(req, res, "response")});

router.get("/event-mode", (req, res)=>{cmcdRequest(req, res, "event")});
router.post("/event-mode", (req, res)=>{cmcdRequest(req, res, "event")});

export default router;