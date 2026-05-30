import { Application } from "express";
import { Server as SocketServer } from "socket.io";
import { logger } from "../utils/logger.js";
import { MessageWS } from "../utils/socketio.js";

let io: SocketServer;

export function setupModCheckRoutes(app: Application, socketIo?: SocketServer): void {
  if (socketIo) {
    io = socketIo;
  }

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

  // 模组检查路由 - 通过文件夹路径和整合包名字检查（异步执行，通过 Socket.IO 推送进度）
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

      // 立即返回任务已接受的响应
      res.json({ status: 200, message: "任务已提交，正在处理中" });

      // 异步执行检查任务
      runModCheckAsync(folderPath, bundleName.trim()).catch(err => {
        logger.error("异步模组检查任务失败", err as Error);
      });
    } catch (err) {
      const error = err as Error;
      logger.error("/modcheck/folder 路由错误", error);
      res.status(500).json({ status: 500, message: "模组检查失败: " + error.message });
    }
  });
}

async function runModCheckAsync(folderPath: string, bundleName: string): Promise<void> {
  const startTime = Date.now();

  try {
    // 获取所有连接的客户端并发送进度
    if (io) {
      io.emit("modcheck_start", { message: "开始提取模组信息..." });
    }

    const { ModCheckService } = await import('../dearth/index.js');
    const checkService = new ModCheckService(folderPath, {
      onProgress: (current: number, total: number, modName: string) => {
        if (io) {
          io.emit("modcheck_progress", {
            current,
            total,
            modName,
            percent: Math.round((current / total) * 100)
          });
        }
      }
    });

    const results = await checkService.checkModsWithBundle(bundleName);
    const duration = Date.now() - startTime;

    // 统计客户端模组数量
    const filteredCount = results.filter(r => r.clientSide === 'required' || r.clientSide === 'optional').length;

    logger.info("模组检查完成", { 总模组数: results.length, 客户端模组数: filteredCount, 耗时: duration });

    if (io) {
      io.emit("modcheck_complete", {
        results,
        filteredCount,
        movedCount: filteredCount,
        duration
      });
    }
  } catch (err) {
    const error = err as Error;
    logger.error("异步模组检查失败", error);
    if (io) {
      io.emit("modcheck_error", {
        error: error.message
      });
    }
  }
}
