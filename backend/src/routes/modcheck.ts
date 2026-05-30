import { Server as SocketServer, Socket } from "socket.io";
import { logger } from "../utils/logger.js";
import { MessageWS } from "../utils/socketio.js";
import { Config } from "../utils/config.js";
import { ModCheckService } from "../dearth/index.js";

let io: SocketServer;

export function setupModCheckSocket(socketIo: SocketServer): void {
  io = socketIo;

  io.on("connection", (socket) => {
    logger.info("Socket.IO 新连接", { id: socket.id });

    // 模组检查请求
    socket.on("modcheck:start", async (data: { folderPath: string; bundleName: string }) => {
      const startTime = Date.now();
      logger.info("收到模组检查请求", { socketId: socket.id, data });

      try {
        if (!data.folderPath) {
          logger.warn("缺少文件夹路径");
          socket.emit("modcheck:error", { error: "缺少文件夹路径" });
          return;
        }

        if (!data.bundleName || !data.bundleName.trim()) {
          logger.warn("缺少整合包名字");
          socket.emit("modcheck:error", { error: "缺少整合包名字" });
          return;
        }

        logger.info("开始模组检查", {
          folderPath: data.folderPath,
          bundleName: data.bundleName.trim()
        });

        const messageWS = new MessageWS(socket);
        const appConfig = Config.getConfig();

        const checkService = new ModCheckService(data.folderPath, {
          enableDexpub: appConfig.filter.dexpub,
          enableModrinth: appConfig.filter.modrinth,
          enableMixin: appConfig.filter.mixins,
          enableHash: appConfig.filter.hashes,
          messageWS,
        });

        const results = await checkService.checkModsWithBundle(data.bundleName.trim());
        const duration = Date.now() - startTime;

        const filteredCount = results.filter(r => r.clientSide === 'required' || r.clientSide === 'optional').length;

        logger.info("模组检查完成", { socketId: socket.id, 总模组数: results.length, 客户端模组数: filteredCount, 耗时: duration });

        messageWS.modcheckComplete(results, filteredCount, filteredCount, duration);
      } catch (err) {
        const error = err as Error;
        logger.error("模组检查失败", { socketId: socket.id, error: error.message, stack: error.stack });
        socket.emit("modcheck:error", { error: error.message });
      }
    });

    socket.on("disconnect", (reason) => {
      logger.info("Socket.IO 断开连接", { id: socket.id, reason });
    });
  });
}
