import prodConfig from "../prodConfig.js";
import {auth, gmail} from "@googleapis/gmail";
import {Source, StatSource} from "../StatSource.js";
import {getOauthDb} from "../db.js";
import type {OAuth2Client} from "google-auth-library";
import {debug, error} from "firebase-functions/logger";

prodConfig();

const {OAuth2} = auth;
const callbackUri = `${process.env.API_BASE}/callback/gmail`;

let _client: OAuth2Client;
const getOauth2Client = () => {
    debug(`Gmail callback URI: ${callbackUri}`, {
        location: "gmail.getOauth2Client",
        callbackUri
    });

    if (!_client) {
        _client = new OAuth2(
            process.env.GMAIL_CLIENT_ID as string,
            process.env.GMAIL_CLIENT_SECRET as string,
            callbackUri
        );
    }
    return _client;
};

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

type GmailStats = {
    num_unread: number;
}

/**
 * Get the login credentials
 * @return {Promise<Credentials>} The credentials
 */
async function getCredentials() {
    const gmailOauthDb = (await getOauthDb()).collection("gmail");

    const doc = await gmailOauthDb.findOne({credentials: true});
    if (!doc || !doc.auth) {
        error("No credentials found!", {
            location: "gmail.getCredentials"
        });
        throw new Error("No credentials found!");
    }
    debug("gmail getCredentials", {
        location: "gmail.getCredentials",
        doc
    });
    return doc.auth as any;
}

/**
 * Set the login credentials
 * @param {Credentials} credentials The credentials
 */
async function saveCredentials(credentials: any) {
    const gmailOauthDb = (await getOauthDb()).collection("gmail");
    const deleteReq = await gmailOauthDb.deleteMany({credentials: true});
    await gmailOauthDb.insertOne({credentials: true, auth: credentials});
    debug("gmail saveCredentials", {
        location: "gmail.saveCredentials",
        deletedCount: deleteReq.deletedCount,
        credentials
    });
}

export default new StatSource(1000 * 60 * 5, Source.GMAIL,
    async () => {
        const stats = {
            num_unread: 0
        } as GmailStats;

        getOauth2Client().setCredentials(await getCredentials());

        const gmailClient = gmail({version: "v1", auth: getOauth2Client()});
        const inboxLabel = await gmailClient.users.labels.get({
            userId: "me",
            id: "INBOX"
        });

        if (typeof inboxLabel.data.messagesUnread === "number") {
            stats.num_unread = inboxLabel.data.messagesUnread;
            debug("Got gmail stats", {
                location: "gmail.refresh",
                data: inboxLabel.data,
            });
        } else {
            error("No labels found", {
                location: "gmail.refresh",
                inboxLabel
            });
        }

        return {
            stats: {
                inbox: stats
            }
        };
    },
    async (req, res) => {
        const authUrl = getOauth2Client().generateAuthUrl({
            access_type: "offline",
            scope: SCOPES,
        });
        debug("Gmail auth URL", {
            location: "gmail.auth",
            authUrl
        });
        res.redirect(authUrl);
    },
    async (req, res) => {
        const {code} = req.query;

        try {
            // Exchange the authorization code for access and refresh tokens
            const {tokens} = await getOauth2Client().getToken(code);
            debug("Gmail tokens", {
                location: "gmail.callback",
                tokens
            });

            // Set the credentials on the OAuth2 client
            await saveCredentials(tokens);

            // Redirect the user to the main page
            res.status(204).end();
        } catch (e) {
            error(`Error getting access token ${e}`, {
                location: "gmail.callback",
                error,
                code
            });
            res.status(500).send("Error getting access token.");
        }
    }
);
