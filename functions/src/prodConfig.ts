import {config} from "dotenv";

export default function prodConfig() {
    config();
    const isProd = process.env.USER !== "max"; // :(
    console.log(`isProd: ${isProd}`);
    if (isProd) {
        for (const key of Object.keys(process.env)) {
            if (key.startsWith("PROD_")) {
                process.env[key.replace("PROD_", "")] = process.env[key];
            }
        }
        console.log(`prodConfig: prod config loaded ${process.env.MONGODB_URI}`);
    }
}
