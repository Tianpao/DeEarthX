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
