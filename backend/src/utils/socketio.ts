import { Socket } from "socket.io";
import { logger } from "./logger.js";

export class MessageWS {
  private socket: Socket;
  
  constructor(socket: Socket) {
    this.socket = socket;
  }

  finish(startTime: number, endTime: number) {
    this.socket.emit("finish", endTime - startTime);
  }

  unzip(entryName: string, total: number, current: number) {
    this.socket.emit("unzip", { name: entryName, total, current });
  }

  download(total: number, index: number, name: string) {
    this.socket.emit("downloading", { total, index, name });
  }

  statusChange() {
    this.socket.emit("changed", undefined);
  }

  handleError(error: Error) {
    this.socket.emit("error", error.message);
  }

  info(message: string) {
    this.socket.emit("info", message);
  }

  serverInstallStart(modpackName: string, minecraftVersion: string, loaderType: string, loaderVersion: string) {
    this.socket.emit("server_install_start", {
      modpackName,
      minecraftVersion,
      loaderType,
      loaderVersion
    });
  }

  serverInstallStep(step: string, stepIndex: number, totalSteps: number, message?: string) {
    this.socket.emit("server_install_step", {
      step,
      stepIndex,
      totalSteps,
      message
    });
  }

  serverInstallProgress(step: string, progress: number, message?: string) {
    this.socket.emit("server_install_progress", {
      step,
      progress,
      message
    });
  }

  serverInstallComplete(installPath: string, duration: number) {
    this.socket.emit("server_install_complete", {
      installPath,
      duration
    });
  }

  serverInstallError(error: string, step?: string) {
    this.socket.emit("server_install_error", {
      error,
      step
    });
  }

  filterModsStart(totalMods: number) {
    this.socket.emit("filter_mods_start", {
      totalMods
    });
  }

  filterModsProgress(current: number, total: number, modName: string) {
    this.socket.emit("filter_mods_progress", {
      current,
      total,
      modName
    });
  }

  filterModsComplete(filteredCount: number, movedCount: number, duration: number) {
    this.socket.emit("filter_mods_complete", {
      filteredCount,
      movedCount,
      duration
    });
  }

  filterModsError(error: string) {
    this.socket.emit("filter_mods_error", {
      error
    });
  }

  // ModCheck 进度事件
  modcheckStart(totalMods: number) {
    this.socket.emit("modcheck_start", {
      totalMods
    });
  }

  modcheckProgress(current: number, total: number, modName: string) {
    this.socket.emit("modcheck_progress", {
      current,
      total,
      modName
    });
  }

  modcheckComplete(results: any[], filteredCount: number, movedCount: number, duration: number) {
    this.socket.emit("modcheck_complete", {
      results,
      filteredCount,
      movedCount,
      duration
    });
  }

  modcheckError(error: string) {
    this.socket.emit("modcheck_error", {
      error
    });
  }
}
