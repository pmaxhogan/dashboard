import {config} from "dotenv";
import {debug} from "firebase-functions/logger";

export default function prodConfig() {
    config();
    const isProd = process.env.USER !== "max"; // :(
    debug(`prodConfig: isProd=${isProd}`, {
        location: "prodConfig",
        isProd
    });
    if (isProd) {
        for (const key of Object.keys(process.env)) {
            if (key.startsWith("PROD_")) {
                process.env[key.replace("PROD_", "")] = process.env[key];
            }
        }
    }
}
