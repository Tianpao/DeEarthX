import fs from "fs";
interface IConfig {
  mirror: {
    bmclapi: boolean;
    mcimirror: boolean;
  };
  filter: {
    hashes: boolean;
    dexpub: boolean;
    mixins: boolean;
  };
}

export class Config {
  private readonly default_config: IConfig = {
    mirror: {
      bmclapi: true,
      mcimirror: true,
    },
    filter: {
      hashes: true,
      dexpub: false,
      mixins: true,
    },
  };
  config(): IConfig {
    if (!fs.existsSync("./config.json")) {
      fs.writeFileSync("./config.json", JSON.stringify(this.default_config));
      return this.default_config;
    }
    return JSON.parse(fs.readFileSync("./config.json", "utf-8"));
  }
  static write_config(config: IConfig) {
    fs.writeFileSync("./config.json", JSON.stringify(config));
  }
}

export default new Config().config();
