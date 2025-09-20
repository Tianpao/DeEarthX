import config from "./utils/config.js";
import fsp from "node:fs/promises";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { yauzl_promise } from "./utils/yauzl.promise.js";
import { Core } from "./core.js";
import { DeEarth } from "./utils/DeEarth.js";
import { version_compare } from "./utils/utils.js";
import { Forge } from "./modloader/forge.js";
import { Minecraft } from "./modloader/minecraft.js";

const core = new Core(config);

core.start();

//console.log(version_compare("1.18.1","1.16.5"))

// await new DeEarth("./mods").Main()

// async function Dex(buffer: Buffer) {

// }
// new Forge("1.20.1","47.3.10").setup()
await new Minecraft("forge","1.20.1").setup()