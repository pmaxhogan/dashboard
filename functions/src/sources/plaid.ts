import prodConfig from "../prodConfig.js";
import {StatSource} from "../StatSource.js";
// import {getOauthDb} from "../db.js";
import {debug, error} from "firebase-functions/logger";
import oauthSuccess from "../oauthSuccess.js";
import {Source} from "../charts/chart.js";
import {Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products} from "plaid";

prodConfig();


const configuration = new Configuration({
    basePath: PlaidEnvironments.sandbox,
    baseOptions: {
        headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
            "PLAID-SECRET": process.env.PLAID_SECRET,
        },
    },
});

const plaidClient = new PlaidApi(configuration);

type PlaidStats = {
    savings: number;
    checking: number;
    stocks: number;
}

/*

/!**
 * Get the login credentials
 *!/
async function getLoginCredentials() {
    const twitterOauthDb = (await getOauthDb()).collection("twitter");
    const doc = await twitterOauthDb.findOne({credentials: true});
    if (!doc || !doc.accessToken || !doc.refreshToken) {
        error("No credentials found!", {
            location: "twitter.getLoginCredentials"
        });
        throw new Error("No credentials found!");
    }
    debug("twitter getLoginCredentials", {
        location: "twitter.getLoginCredentials",
        doc
    });
    return doc;
}

/!**
 * Set the login credentials
 * @param {string} accessToken
 * @param {string | undefined} refreshToken
 *!/
async function setLoginCredentials(accessToken: string, refreshToken: string | undefined) {
    const twitterOauthDb = (await getOauthDb()).collection("twitter");
    const delReq = await twitterOauthDb.deleteMany({credentials: true});
    await twitterOauthDb.insertOne({accessToken, refreshToken, credentials: true});
    debug("twitter setLoginCredentials", {
        location: "twitter.setLoginCredentials",
        accessToken,
        refreshToken,
        numDeleted: delReq.deletedCount
    });
}*/

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default new StatSource(1000 * 60 * 60, Source.PLAID,
    async () => {
        const stats:PlaidStats = {
            savings: 0,
            checking: 0,
            stocks: 0
        };

        debug("plaid getStats", {
            location: "plaid.getStats",
            stats
        });

        return {
            stats: {
                "profile": stats
            }
        };
    },
    async (req, res) => {
        try {
            const redirectUri = `${process.env.API_BASE}/callback/plaid`;
            console.log("redirectUri", redirectUri);

            const plaidReq = await plaidClient.linkTokenCreate({
                products: [Products.Assets, Products.Investments],
                client_name: "Dashboard",
                language: "en",
                country_codes: [CountryCode.Us],
                user: {
                    client_user_id: "user-id",
                },
                redirect_uri: redirectUri
            });
            const linkToken = plaidReq.data.link_token;

            debug("plaid login", {
                location: "plaid.login",
                linkToken
            });

            res.json({linkToken});
        } catch (err) {
            error("Could not get link token!", {
                location: "plaid.login",
                err: (err as any)?.response?.data || err
            });
            return res.status(400).send("Could not get link token!");
        }
    },
    async (req, res) => {
        // Extract state and code from query string
        // eslint-disable-next-line camelcase
        const {public_token} = req.query;

        // eslint-disable-next-line camelcase
        if (!public_token) {
            return res.status(400).send("Could not exchange public_token!");
        }

        debug("plaid callback", {
            location: "plaid.callback",
            // eslint-disable-next-line camelcase
            public_token
        });


        try {
            // eslint-disable-next-line camelcase
            const response = await plaidClient.itemPublicTokenExchange({public_token});
            const accessToken = response.data.access_token;
            const itemId = response.data.item_id;

            debug("plaid callback results", {
                location: "plaid.callback",
                accessToken,
                itemId
            });

            const itemRes = await plaidClient.itemGet({
                access_token: accessToken,
            });
            const item = itemRes.data.item;
            const status = itemRes.data.status;

            debug("plaid callback item results", {
                location: "plaid.callback",
                item,
                status
            });
        } catch (err) {
            error("Could not exchange public_token!", {
                location: "plaid.callback",
                // eslint-disable-next-line camelcase
                public_token,
                err
            });
            return res.status(400).send("Could not exchange public_token!");
        }

        return oauthSuccess(req, res);
    }
);
