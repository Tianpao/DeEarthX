import { Config } from "./utils/config.js";
import { Core } from "./core.js";

// 创建核心实例并启动服务
const config = Config.getConfig();
const core = new Core(config);

core.start();