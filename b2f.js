import fs from "node:fs";

const args = process.argv.slice(2);

if (args.length !== 1) {
    process.exit(1);
}

switch (args[0]) {
    case "b2f": //backend to frontend
        fs.renameSync("./backend/dist/core.exe", "./front/src-tauri/binaries/core-x86_64-pc-windows-msvc.exe") //后端文件复制
        break;
    case "b2r": //build to root
        fs.renameSync("./front/src-tauri/target/release/bundle/nsis/DeEarthX-V3_0.1.0_x64-setup.exe","./DeEarthX-V3_x64-setup.exe")
        break;
}
