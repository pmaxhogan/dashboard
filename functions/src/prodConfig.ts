import {config} from "dotenv";

export default function prodConfig() {
    config();
    const isProd = process.env.USER !== "max"; // :(
    if (isProd) {
        for (const key of Object.keys(process.env)) {
            if (key.startsWith("PROD_")) {
                process.env[key.replace("PROD_", "")] = process.env[key];
            }
        }
        console.log("prodConfig: prod config loaded");
    } else {
        console.log("prodConfig: local config");
    }
}
