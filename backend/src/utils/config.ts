import fs from "node:fs";

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
  };
  oaf: boolean;
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
  },
  oaf: true
};

/**
 * 配置文件路径
 */
const CONFIG_PATH = "./config.json";

/**
 * 配置管理器
 */
export class Config {
  /**
   * 获取配置
   * @returns 配置对象
   */
  public static getConfig(): IConfig {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
      return DEFAULT_CONFIG;
    }
    
    try {
      const content = fs.readFileSync(CONFIG_PATH, "utf-8");
      return JSON.parse(content);
    } catch (err) {
      console.error("Failed to read config file, using defaults", err);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * 写入配置
   * @param config 配置对象
   */
  public static writeConfig(config: IConfig): void {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error("Failed to write config file", err);
    }
  }
}

// 默认导出配置实例
export default Config.getConfig();
