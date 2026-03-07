import fs from "node:fs";
import path from "node:path";
import { logger } from './logger.js';

/**
 * 应用配置接口
 */
export interface IConfig {
  mirror: {
    bmclapi: boolean;
    mcimirror: boolean;
  };
  filter: {
    hashes: boolean;
    dexpub: boolean;
    mixins: boolean;
    modrinth: boolean;
  };
  oaf: boolean;
  autoZip: boolean;
  port?: number;
  host?: string;
  javaPath?: string;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: IConfig = {
  mirror: {
    bmclapi: true,
    mcimirror: true,
  },
  filter: {
    hashes: true,
    dexpub: true,
    mixins: true,
    modrinth: false,
  },
  oaf: true,
  autoZip: false,
  port: 37019,
  host: 'localhost',
  javaPath: undefined
};

/**
 * 获取可执行文件所在目录
 * 在开发环境返回当前目录,在生产环境返回可执行文件所在目录
 */
function getAppDir(): string {
  const execPath = process.execPath;
  const cwd = process.cwd();
  
  // 检查是否在开发环境中运行
  // 如果 execPath 指向 node.exe 且当前目录不是 node 安装目录，说明是开发环境
  const isDevelopment = execPath.toLowerCase().includes('node.exe') && 
                        !cwd.toLowerCase().includes('program files') &&
                        !cwd.toLowerCase().includes('nodejs');
  
  if (isDevelopment) {
    return cwd;
  }
  
  return path.dirname(execPath);
}

/**
 * 配置文件路径 - 使用可执行文件所在目录
 */
const CONFIG_PATH = path.join(getAppDir(), "config.json");

/**
 * 从环境变量获取配置
 * @param key 环境变量键
 * @param defaultValue 默认值
 * @returns 环境变量值或默认值
 */
function getEnv<T>(key: string, defaultValue: T): T {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  
  if (typeof defaultValue === 'boolean') {
    return (value.toLowerCase() === 'true') as unknown as T;
  }
  
  if (typeof defaultValue === 'number') {
    const num = parseInt(value, 10);
    return (isNaN(num) ? defaultValue : num) as unknown as T;
  }
  
  return value as unknown as T;
}

/**
 * 配置管理器
 */
export class Config {
  /**
   * 获取配置
   * @returns 配置对象
   */
  public static getConfig(): IConfig {
    // 读取配置文件
    let config: IConfig;
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
      config = DEFAULT_CONFIG;
    } else {
      try {
        const content = fs.readFileSync(CONFIG_PATH, "utf-8");
        config = JSON.parse(content);
      } catch (err) {
        logger.error("Failed to read config file, using defaults", err as Error);
        config = DEFAULT_CONFIG;
      }
    }
    
    // 从环境变量覆盖配置
    const envConfig: IConfig = {
      mirror: {
        bmclapi: getEnv('DEEARTHX_MIRROR_BMCLAPI', config.mirror.bmclapi),
        mcimirror: getEnv('DEEARTHX_MIRROR_MCIMIRROR', config.mirror.mcimirror)
      },
      filter: {
        hashes: getEnv('DEEARTHX_FILTER_HASHES', config.filter.hashes),
        dexpub: getEnv('DEEARTHX_FILTER_DEXPUB', config.filter.dexpub),
        mixins: getEnv('DEEARTHX_FILTER_MIXINS', config.filter.mixins),
        modrinth: getEnv('DEEARTHX_FILTER_MODRINTH', config.filter.modrinth)
      },
      oaf: getEnv('DEEARTHX_OAF', config.oaf),
      autoZip: getEnv('DEEARTHX_AUTO_ZIP', config.autoZip),
      port: getEnv('DEEARTHX_PORT', config.port || DEFAULT_CONFIG.port),
      host: getEnv('DEEARTHX_HOST', config.host || DEFAULT_CONFIG.host)
    };
    
    logger.debug("Loaded config", envConfig);
    return envConfig;
  }

  /**
   * 写入配置
   * @param config 配置对象
   */
  public static writeConfig(config: IConfig): void {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      logger.info("Config file written successfully");
    } catch (err) {
      logger.error("Failed to write config file", err as Error);
    }
  }
}

// 默认导出配置实例
export default Config.getConfig();
