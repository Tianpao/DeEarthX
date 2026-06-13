import { SpawnOptions, spawn } from "node:child_process";
import { logger } from "./logger.js";

/**
 * 将 Maven 坐标转换为仓库路径或 URL
 * @param coordinate Maven 坐标，格式: groupId:artifactId:version[:classifier@extension]
 * @param base 可选的基础路径或 URL，默认为空（返回相对路径）
 * @returns 例如 "org/ow2/asm/asm/9.9/asm-9.9.jar"
 */
export function mavenToUrl(coordinate: string, base = "") {
  // 按冒号拆分坐标
  const [groupId, artifactId, version, classifierAndExt] = coordinate.split(":");
  
  // 提取 classifier 和 extension，默认 extension 为 "jar"
  let [classifier, extension = "jar"] = (classifierAndExt || "").split("@");
  
  // 只有当 classifier 存在且非空时才添加连字符
  const classifierSuffix = classifier ? `-${classifier}` : "";
  
  // 清理 base 末尾的斜杠
  const basePath = base.replace(/\/$/, "");
  
  // 将 groupId 中的点替换为斜杠
  const groupPath = groupId.replace(/\./g, "/");
  
  // 构建文件路径
  const filePath = `${groupPath}/${artifactId}/${version}/${artifactId}-${version}${classifierSuffix}.${extension}`;
  
  // 如果 base 为空，直接返回相对路径；否则拼接 base 和路径
  return basePath ? `${basePath}/${filePath}` : filePath;
}

export function execPromise(cmd: string, options?: SpawnOptions): Promise<number> {
  logger.debug(`执行命令: ${cmd}`);

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, {
      ...options,
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout?.on('data', (chunk: unknown) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
      logger.debug(text.trim());
    });

    child.stderr?.on('data', (chunk: unknown) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
      logger.error(text.trim());
    });

    child.on('error', (err) => {
      logger.error(`命令执行错误: ${cmd}`);
      reject(err);
    });

    child.on('close', (code) => {
      logger.debug(`命令执行完成，退出码: ${code}`);
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
        return;
      }
      resolve(code ?? 0);
    });
  });
}
