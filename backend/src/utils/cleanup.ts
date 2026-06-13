import fs from "node:fs";
import path from "node:path";
import { logger } from "../utils/logger.js";

/**
 * 清理服务端安装后产生的安装文件和日志
 * @param instancePath 实例目录路径
 */
export async function cleanupInstallFiles(instancePath: string): Promise<void> {
  const filesToClean: string[] = [];

  // 1. 收集 forge-*-installer.jar 文件
  const entries = await fs.promises.readdir(instancePath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && /^forge-.*-installer\.jar$/.test(entry.name)) {
      filesToClean.push(path.join(instancePath, entry.name));
    }
  }

  // 2. 收集 fabric-installer.jar 文件
  const fabricInstaller = path.join(instancePath, "fabric-installer.jar");
  if (fs.existsSync(fabricInstaller)) {
    filesToClean.push(fabricInstaller);
  }

  // 3. 收集 installer.log 文件
  const installerLog = path.join(instancePath, "installer.log");
  if (fs.existsSync(installerLog)) {
    filesToClean.push(installerLog);
  }

  // 删除文件
  for (const file of filesToClean) {
    try {
      fs.unlinkSync(file);
      logger.info(`已清理安装文件: ${path.basename(file)}`);
    } catch (error) {
      logger.warn(`清理文件失败 ${path.basename(file)}: ${error}`);
    }
  }
}
