import fse from "fs-extra"
import { Forge } from "./forge.js";

class NeoForge extends Forge{
constructor(minecraft:string,loaderVersion:string){
    super(minecraft,loaderVersion); //子承父业
}

async setup(){
    await this.installer();
    await this.library();
}

async installer(){
    const res = (await this.got.get(`neoforge/version/${this.loaderVersion}/download/installer.jar`)).rawBody;
    await fse.outputFile(`./forge/forge-${this.minecraft}-${this.loaderVersion}-installer.jar`,res);
}
}