import prodConfig from "../prodConfig.js";
import {StatSource} from "../StatSource.js";
import {TwitterApi} from "twitter-api-v2";
import {TwitterApiAutoTokenRefresher} from "@twitter-api-v2/plugin-token-refresher";
import {UserV2} from "twitter-api-v2/dist/esm/types/v2/user.v2.types";
import {getOauthDb} from "../db.js";
import {debug, error} from "firebase-functions/logger";
import oauthSuccess from "../oauthSuccess.js";
import {Source} from "../chart.js";

prodConfig();

type TwitterStats = {
    followers: number;
    following: number;
    tweets: number;
    lists: number;
}

const loginClient = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID as string,
    clientSecret: process.env.TWITTER_CLIENT_SECRET as string
});

const callbackUri = `${process.env.API_BASE}/callback/twitter?apiKey=${process.env.NEXT_PUBLIC_API_KEY}`;

/**
 * Login verifier
 * @param {string} state The state parameter
 */
async function getLoginVerifierFromState(state: string) {
    const twitterOauthDb = (await getOauthDb()).collection("twitter");
    const doc = await twitterOauthDb.findOne({state});
    debug("twitter getLoginVerifierFromState", {
        location: "twitter.getLoginVerifierFromState",
        codeVerifier: doc?.codeVerifier,
        state
    });
    if (doc) {
        return doc.codeVerifier;
    } else {
        error(`No code verifier found for state ${state}`, {
            location: "twitter.getLoginVerifierFromState",
        });
    }
}

/**
 * Login verifier
 * @param {string} state The state parameter
 * @param {string} verifier The verifier parameter
 */
async function setLoginVerifierForState(state: string, verifier: string) {
    const twitterOauthDb = (await getOauthDb()).collection("twitter");
    await twitterOauthDb.insertOne({state, codeVerifier: verifier});
    debug("twitter setLoginVerifierForState", {
        location: "twitter.setLoginVerifierForState",
        state,
    });
}

/**
 * Get the login credentials
 */
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

/**
 * Set the login credentials
 * @param {string} accessToken
 * @param {string | undefined} refreshToken
 */
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
}

export default new StatSource(1000 * 60 * 60 * 6, Source.TWITTER,
    async () => {
        const {accessToken, refreshToken} = await getLoginCredentials();

        const autoRefresherPlugin = new TwitterApiAutoTokenRefresher({
            refreshToken,
            refreshCredentials: {
                clientId: process.env.TWITTER_CLIENT_ID as string,
                clientSecret: process.env.TWITTER_CLIENT_SECRET as string
            },
            onTokenUpdate(token) {
                setLoginCredentials(token.accessToken, token.refreshToken);
            },
        });

        const client = new TwitterApi(accessToken, {plugins: [autoRefresherPlugin]});

        let data: UserV2;

        const real = process.env.REAL_TWITTER === "true";

        debug(`twitter getStats ${real}`, {
            location: "twitter.getStats",
            real
        });

        if (real) {
            data = (await client.v2.me({
                "user.fields": ["description", "id", "location", "name", "profile_image_url", "public_metrics", "username"]
            })).data;
        } else {
            data = {
                "public_metrics": {
                    "followers_count": 363,
                    "following_count": 383,
                    "tweet_count": 355,
                    "listed_count": 0
                },
            } as UserV2;
        }


        const stats: TwitterStats = {
            followers: data?.public_metrics?.followers_count ?? 0,
            following: data?.public_metrics?.following_count ?? 0,
            tweets: data?.public_metrics?.tweet_count ?? 0,
            lists: data?.public_metrics?.listed_count ?? 0
        };

        debug("twitter getStats", {
            location: "twitter.getStats",
            stats
        });

        return {
            stats: {
                "profile": stats
            }
        };
    },
    async (req, res) => {
        const {
            url,
            codeVerifier,
            state
        } = loginClient.generateOAuth2AuthLink(callbackUri, {scope: ["tweet.read", "users.read", "offline.access"]});

        await setLoginVerifierForState(state, codeVerifier);

        debug("twitter login", {
            location: "twitter.login",
            url,
        });

        res.redirect(url);
    },
    async (req, res) => {
        // Extract state and code from query string
        const {state, code} = req.query;
        // Check if a verifier is associated with given state
        const codeVerifier = await getLoginVerifierFromState(state);

        if (!codeVerifier || !code) {
            error("No code verifier or code!", {
                location: "twitter.callback",
                codeVerifier,
                code,
                state
            });
            return res.status(400).send("You denied the app or your session expired!");
        }

        try {
            // Get tokens
            const {accessToken, refreshToken} = await loginClient.loginWithOAuth2({
                code,
                codeVerifier,
                redirectUri: callbackUri
            });

            await setLoginCredentials(accessToken, refreshToken);
        } catch (e) {
            error(`Invalid verifier or access tokens! ${e}`, {
                location: "twitter.callback",
                codeVerifier,
                code,
                state,
                e
            });
            return res.status(403).send("Invalid verifier or access tokens!");
        }

        return oauthSuccess(req, res);
    }
);
