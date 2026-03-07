import fs from "node:fs";
import archiver from "archiver";
import path from "node:path";

const args = process.argv.slice(2);

if (args.length !== 1) {
    console.error("使用方法: node b2f.js <b2f|b2r>");
    process.exit(1);
}

switch (args[0]) {
    case "b2f": //backend to frontend
        const sourcePath = "./backend/dist/core.exe";
        const destPath = "./front/src-tauri/binaries/core-x86_64-pc-windows-msvc.exe";

        if (!fs.existsSync(sourcePath)) {
            console.error(`错误: 源文件不存在: ${sourcePath}`);
            console.error("请先运行 'npm run backend' 构建后端");
            process.exit(1);
        }

        // 确保目标目录存在
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
            console.log(`创建目录: ${destDir}`);
        }

        // 复制文件
        fs.copyFileSync(sourcePath, destPath);
        console.log(`成功复制: ${sourcePath} -> ${destPath}`);
        break;
    case "b2r": //build to root
        const exePath = "./front/src-tauri/target/release/bundle/nsis/DeEarthX-V3_1.0.0_x64-setup.exe";
        const rootExePath = "./DeEarthX-V3_x64-setup.exe";
        const zipPath = "./DeEarthX-V3_x64-setup.zip";

        if (!fs.existsSync(exePath)) {
            console.error(`错误: 源文件不存在: ${exePath}`);
            console.error("请先运行 'npm run tauri' 构建前端");
            process.exit(1);
        }

        // 移动 exe 到根目录
        fs.renameSync(exePath, rootExePath);
        console.log(`移动文件: ${exePath} -> ${rootExePath}`);

        // 打包成 zip
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", {
            zlib: { level: 9 } // 最高压缩级别
        });

        output.on('close', () => {
            console.log(`打包完成: ${zipPath} (${archive.pointer()} 字节)`);
        });

        archive.pipe(output);
        archive.file(rootExePath, { name: path.basename(rootExePath) });
        await archive.finalize();

        break;
    default:
        console.error(`错误: 未知参数 '${args[0]}'`);
        console.error("有效参数: b2f, b2r");
        process.exit(1);
}
