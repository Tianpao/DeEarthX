import config from "./utils/config.js";
import { Core } from "./core.js";

// 创建核心实例并启动服务
const core = new Core(config);

core.start();

// ==================== 调试/测试代码区域（已注释） ====================

// 版本比较测试
// console.log(version_compare("1.18.1", "1.16.5"))

// DeEarth 模块测试
// await new DeEarth("./mods").Main()

// Dex 函数定义示例
// async function Dex(buffer: Buffer) {
// }

// 模组加载器安装测试
// new Forge("1.20.1", "47.3.10").setup()                    // 安装 Forge 服务端
// await new NeoForge("1.21.1", "21.1.1").setup()            // 安装 NeoForge 服务端
// await new Minecraft("forge", "1.20.1", "0").setup()       // 安装 Minecraft + Forge
// await new Minecraft("forge", "1.16.5", "0").setup()       // 安装 Minecraft + Forge (1.16.5)
// await new Fabric("1.20.1", "0.17.2").setup()              // 安装 Fabric 服务端