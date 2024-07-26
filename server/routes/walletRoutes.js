import express from "express";
import { walletActivity } from "../controllers/walletControllers.js";

const router = express.Router();

router.get("/mainnet/activity", walletActivity);

export default router;
