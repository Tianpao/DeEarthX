import { Application } from "express";
import { logger } from "../utils/logger.js";

export function setupModCheckRoutes(app: Application): void {
  // 模组检查路由 - 通过路径检查
  app.get('/modcheck', async (req, res) => {
    try {
      const modsPath = req.query.path as string;
      if (!modsPath) {
        return res.status(400).json({ status: 400, message: "缺少 path 参数" });
      }

      const { ModCheckService } = await import('../dearth/index.js');
      const checkService = new ModCheckService(modsPath);
      const results = await checkService.checkMods();

      res.json(results);
    } catch (err) {
      const error = err as Error;
      logger.error("/modcheck 路由错误", error);
      res.status(500).json({ status: 500, message: "模组检查失败" });
    }
  });

  // 模组检查路由 - 通过文件夹路径和整合包名字检查
  app.post('/modcheck/folder', async (req, res) => {
    try {
      const { folderPath, bundleName } = req.body;

      if (!folderPath) {
        logger.warn("请求中缺少文件夹路径");
        return res.status(400).json({ status: 400, message: "缺少文件夹路径" });
      }

      if (!bundleName || !bundleName.trim()) {
        logger.warn("请求中缺少整合包名字");
        return res.status(400).json({ status: 400, message: "缺少整合包名字" });
      }

      logger.info("收到模组检查文件夹请求", {
        folderPath,
        bundleName: bundleName.trim()
      });

      const { ModCheckService } = await import('../dearth/index.js');
      const checkService = new ModCheckService(folderPath);
      const results = await checkService.checkModsWithBundle(bundleName.trim());

      logger.info("模组检查完成", { resultsCount: results.length });
      res.json(results);
    } catch (err) {
      const error = err as Error;
      logger.error("/modcheck/folder 路由错误", error);
      res.status(500).json({ status: 500, message: "模组检查失败: " + error.message });
    }
  });
}
