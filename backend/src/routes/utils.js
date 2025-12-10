import express from "express";
import * as utilController from "../controllers/utilController.js";

const router = express.Router();

router.get("/tx/:txHash", utilController.getTxStatus);
router.get("/script/:address/utxos", utilController.getScriptUtxosList);

export default router;

