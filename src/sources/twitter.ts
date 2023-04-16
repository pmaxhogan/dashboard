import {config} from "dotenv";
config();

import {StatSource} from "../StatSource";
import {TwitterApi} from "twitter-api-v2";
import {oauth} from "../db";
import {TwitterApiAutoTokenRefresher} from "@twitter-api-v2/plugin-token-refresher";

type TwitterStats = {
    followers: number;
}

const loginClient = new TwitterApi({
    // appKey: process.env.TWITTER_API_KEY as string,
    // appSecret: process.env.TWITTER_API_SECRET as string,
    clientId: process.env.TWITTER_CLIENT_ID as string,
    clientSecret: process.env.TWITTER_CLIENT_SECRET as string
});

const twitterOauthDb = oauth.collection("twitter");

const callbackUri = `${process.env.API_BASE}/callback/twitter`;

/**
 * Login verifier
 * @param {string} state The state parameter
 */
async function getLoginVerifierFromState(state: string) {
    const doc = await twitterOauthDb.findOne({state});
    if (doc) {
        return doc.codeVerifier;
    }
}

/**
 * Login verifier
 * @param {string} state The state parameter
 * @param {string} verifier The verifier parameter
 */
async function setLoginVerifierForState(state: string, verifier: string) {
    await twitterOauthDb.insertOne({state, codeVerifier: verifier});
}

/**
 * Get the login credentials
 */
async function getLoginCredentials() {
    const doc = await twitterOauthDb.findOne({credentials: true});
    if (!doc || !doc.accessToken || !doc.refreshToken) {
        throw new Error("No credentials found!");
    }
    return doc;
}

/**
 * Set the login credentials
 * @param {string} accessToken
 * @param {string | undefined} refreshToken
 */
async function setLoginCredentials(accessToken: string, refreshToken: string | undefined) {
    await twitterOauthDb.deleteMany({credentials: true});
    await twitterOauthDb.insertOne({accessToken, refreshToken, credentials: true});
}

export default new StatSource(1000 * 60 * 60, "twitter",
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


        const {data} = await client.v2.me({
            "user.fields": ["description", "id", "location", "name", "profile_image_url", "public_metrics", "username"]
        });
        console.log(data);


        const stats: TwitterStats = {
            followers: 0
        };

        return {
            stats
        };
    },
    async (req, res) => {
        const {url, codeVerifier, state} = loginClient.generateOAuth2AuthLink(callbackUri, {scope: ["tweet.read", "users.read", "offline.access"]});

        await setLoginVerifierForState(state, codeVerifier);

        res.send({url});
    },
    async (req, res) => {
        // Extract state and code from query string
        const {state, code} = req.query;
        // Check if a verifier is associated with given state
        const codeVerifier = await getLoginVerifierFromState(state);

        if (!codeVerifier || !code) {
            return res.status(400).send("You denied the app or your session expired!");
        }

        try {
            // Get tokens
            const {accessToken, refreshToken} = await loginClient.loginWithOAuth2({
                code,
                codeVerifier,
                redirectUri: callbackUri
            });

            // Get user ID
            // const concernedUser = await client.v2.me()

            // Store credentials
            await setLoginCredentials(accessToken, refreshToken);
        } catch (e) {
            return res.status(403).send("Invalid verifier or access tokens!");
        }

        res.send("You are now logged in!");
    }
);
