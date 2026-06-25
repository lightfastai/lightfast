import { Config } from "@remotion/cli/config";
import { enableCssLoaders } from "./src/webpack-override";

Config.setEntryPoint("src/index.ts");
Config.setOverwriteOutput(true);
Config.setPublicDir("../../apps/www/public");
Config.overrideWebpackConfig(enableCssLoaders);
