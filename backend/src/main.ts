import config from "./utils/config.js";
import { Core } from "./core.js";

const core = new Core(config);

core.start();

//console.log(version_compare("1.18.1","1.16.5"))

// await new DeEarth("./mods").Main()

// async function Dex(buffer: Buffer) {

// }
//new Forge("1.20.1","47.3.10").setup()
//await new NeoForge("1.21.1","21.1.1").setup()
//await new Minecraft("forge","1.20.1","0").setup()
// await new Minecraft("forge","1.16.5","0").setup()
//await new Fabric("1.20.1","0.17.2").setup()