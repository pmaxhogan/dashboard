import prodConfig from "./prodConfig.js";
prodConfig();


const pastebinApiKey = process.env.PASTEBIN_API_KEY as string;
import fetch from "node-fetch";

/**
 * TUrns data into a pastebin url to data.
 * @param {String} data the data
 * @return {Strong} URL
 */
export default async function createPasteBin(data:string) {
    const endpoint = "https://pastebin.com/api/api_post.php";
    const params = new URLSearchParams({
        api_dev_key: pastebinApiKey,
        api_option: "paste",
        api_paste_code: data,
        api_paste_private: "1"
    });

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            body: params,
        });

        if (response.ok) {
            const pasteURL = await response.text();
            console.log("Paste created:", pasteURL);
        } else {
            console.error("Failed to create paste:", response.status + "\n" + await response.text());
        }
    } catch (error) {
        console.error("Error creating paste:", error);
    }
}

