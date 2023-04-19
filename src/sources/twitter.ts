import {config} from "dotenv";
config();

import {Source, StatSource} from "../StatSource";
import {TwitterApi} from "twitter-api-v2";
import {oauth} from "../db";
import {TwitterApiAutoTokenRefresher} from "@twitter-api-v2/plugin-token-refresher";
import {UserV2} from "twitter-api-v2/dist/esm/types/v2/user.v2.types";

type TwitterStats = {
    followers: number;
    following: number;
    tweets: number;
    lists: number;
}

const useReal = process.env.REAL_TWITTER === "true";

const loginClient = new TwitterApi({
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

export default new StatSource(useReal ? 1000 * 60 * 60 : 1000, Source.TWITTER,
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

        let data:UserV2;

        if (useReal) {
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

        return {
            stats: {
                "profile": stats
            }
        };
    },
    async (req, res) => {
        const {url, codeVerifier, state} = loginClient.generateOAuth2AuthLink(callbackUri, {scope: ["tweet.read", "users.read", "offline.access"]});

        await setLoginVerifierForState(state, codeVerifier);

        res.redirect(url);
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

            await setLoginCredentials(accessToken, refreshToken);
        } catch (e) {
            return res.status(403).send("Invalid verifier or access tokens!");
        }

        res.send("<!DOCTYPE html><script>close();</script>You can now close this window!");
    }
);
