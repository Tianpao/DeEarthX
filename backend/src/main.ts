import config,{ Config } from "./utils/config.js";

const input = process.argv[2];

switch (input) {
    case 'getconfig': //读取配置
        process.stdout.write(JSON.stringify(config));
        break;
    case 'writeconfig': //写入配置
        if(process.argv.length < 4){
            process.exit(1);
        }
        Config.write_config(JSON.parse(process.argv[3]));
        break;
    case 'start':
}