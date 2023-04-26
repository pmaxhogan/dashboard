export default function prodConfig() {
    if (process.env.NODE_ENV === "prod") {
        for (const key of Object.keys(process.env)) {
            if (key.startsWith("PROD_")) {
                process.env[key.replace("PROD_", "")] = process.env[key];
            }
        }
    }
}
