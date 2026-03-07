import websocket, { WebSocketServer } from "ws";
import { logger } from "./logger.js";

export class MessageWS {
  private ws!: websocket;
  
  constructor(ws: websocket) {
    this.ws = ws;
    
    // 监听WebSocket错误
    this.ws.on('error', (err) => {
      logger.error("WebSocket error", err);
    });
    
    // 监听连接关闭
    this.ws.on('close', (code, reason) => {
      logger.info("WebSocket connection closed", { code, reason: reason.toString() });
    });
  }

  /**
   * 发送完成消息
   * @param startTime 开始时间
   * @param endTime 结束时间
   */
  finish(startTime: number, endTime: number) {
    this.send("finish", endTime - startTime);
  }

  /**
   * 发送解压进度消息
   * @param entryName 文件名
   * @param total 总文件数
   * @param current 当前文件索引
   */
  unzip(entryName: string, total: number, current: number) {
    this.send("unzip", { name: entryName, total, current });
  }

  /**
   * 发送下载进度消息
   * @param total 总文件数
   * @param index 当前文件索引
   * @param name 文件名
   */
  download(total: number, index: number, name: string) {
    this.send("downloading", { total, index, name });
  }

  /**
   * 发送状态变更消息
   */
  statusChange() {
    this.send("changed", undefined);
  }

  /**
   * 发送错误消息
   * @param error 错误对象
   */
  handleError(error: Error) {
    this.send("error", error.message);
  }

  /**
   * 发送信息消息
   * @param message 消息内容
   */
  info(message: string) {
    this.send("info", message);
  }

  /**
   * 发送服务端安装开始消息
   * @param modpackName 整合包名称
   * @param minecraftVersion Minecraft版本
   * @param loaderType 加载器类型
   * @param loaderVersion 加载器版本
   */
  serverInstallStart(modpackName: string, minecraftVersion: string, loaderType: string, loaderVersion: string) {
    this.send("server_install_start", {
      modpackName,
      minecraftVersion,
      loaderType,
      loaderVersion
    });
  }

  /**
   * 发送服务端安装步骤消息
   * @param step 当前步骤名称
   * @param stepIndex 步骤索引
   * @param totalSteps 总步骤数
   * @param message 步骤详情
   */
  serverInstallStep(step: string, stepIndex: number, totalSteps: number, message?: string) {
    this.send("server_install_step", {
      step,
      stepIndex,
      totalSteps,
      message
    });
  }

  /**
   * 发送服务端安装进度消息
   * @param step 当前步骤
   * @param progress 进度百分比 (0-100)
   * @param message 进度详情
   */
  serverInstallProgress(step: string, progress: number, message?: string) {
    this.send("server_install_progress", {
      step,
      progress,
      message
    });
  }

  /**
   * 发送服务端安装完成消息
   * @param installPath 安装路径
   * @param duration 耗时(毫秒)
   */
  serverInstallComplete(installPath: string, duration: number) {
    this.send("server_install_complete", {
      installPath,
      duration
    });
  }

  /**
   * 发送服务端安装错误消息
   * @param error 错误信息
   * @param step 出错的步骤
   */
  serverInstallError(error: string, step?: string) {
    this.send("server_install_error", {
      error,
      step
    });
  }

  /**
   * 发送筛选模组开始消息
   * @param totalMods 总模组数
   */
  filterModsStart(totalMods: number) {
    this.send("filter_mods_start", {
      totalMods
    });
  }

  /**
   * 发送筛选模组进度消息
   * @param current 当前处理的模组索引
   * @param total 总模组数
   * @param modName 模组名称
   */
  filterModsProgress(current: number, total: number, modName: string) {
    this.send("filter_mods_progress", {
      current,
      total,
      modName
    });
  }

  /**
   * 发送筛选模组完成消息
   * @param filteredCount 筛选出的客户端模组数
   * @param movedCount 成功移动的数量
   * @param duration 耗时(毫秒)
   */
  filterModsComplete(filteredCount: number, movedCount: number, duration: number) {
    this.send("filter_mods_complete", {
      filteredCount,
      movedCount,
      duration
    });
  }

  /**
   * 发送筛选模组错误消息
   * @param error 错误信息
   */
  filterModsError(error: string) {
    this.send("filter_mods_error", {
      error
    });
  }

  /**
   * 通用消息发送方法
   * @param status 消息状态
   * @param result 消息内容
   */
  private send(status: string, result: any) {
    try {
      if (this.ws.readyState === websocket.OPEN) {
        const message = JSON.stringify({ status, result });
        logger.debug("Sending WebSocket message", { status, result });
        this.ws.send(message);
      } else {
        logger.warn(`WebSocket not open, cannot send message: ${status}`);
      }
    } catch (err) {
      logger.error("Failed to send WebSocket message", err);
    }
  }
}
