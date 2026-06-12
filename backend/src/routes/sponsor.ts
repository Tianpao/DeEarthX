import express, { Router } from "express";
import got, { Got } from "got";
import { logger } from "../utils/logger.js";

export interface Sponsor {
    id: number;
    name: string;
    imageUrl: string;
    url: string;
    tone: "gold" | "silver" | "bronze";
}

let sponsorCache: Sponsor[] | null = null;

export function setupSponsorRoutes(app: express.Application) {
    const router: Router = express.Router();
    const gotClient: Got = got.extend({
        prefixUrl: "https://galaxy.tianpao.top/",
        headers: {
            "User-Agent": "DeEarthX",
        },
        responseType: "json",
    });

    // GET /sponsor/ - 获取所有赞助商（公开API）
    router.get("/", async (_req, res) => {
        if (sponsorCache) {
            logger.info("返回缓存的赞助商列表", { count: sponsorCache.length });
            res.json(sponsorCache);
            return;
        }

        try {
            const response = await gotClient.get<Sponsor[]>("sponsor/");
            sponsorCache = response.body;
            logger.info("获取赞助商列表成功", { count: response.body.length });
            res.json(response.body);
        } catch (error) {
            logger.error("获取赞助商列表失败", error as Error);
            res.status(500).json({ error: "获取赞助商列表失败" });
        }
    });

    app.use("/sponsor", router);
}
