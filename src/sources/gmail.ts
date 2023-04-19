import {config} from "dotenv";
import {auth, gmail} from "@googleapis/gmail";
import {Source, StatSource} from "../StatSource";
import {oauth} from "../db";
import {Credentials} from "google-auth-library/build/src/auth/credentials";

config();

const {OAuth2} = auth;
const callbackUri = `${process.env.API_BASE}/callback/gmail`;
const gmailOauthDb = oauth.collection("gmail");

const oauth2Client = new OAuth2(
    process.env.GMAIL_CLIENT_ID as string,
    process.env.GMAIL_CLIENT_SECRET as string,
    callbackUri
);

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

type GmailStats = {
    num_unread: number;
}

/**
 * Get the login credentials
 * @return {Promise<Credentials>} The credentials
 */
async function getCredentials() {
    const doc = await gmailOauthDb.findOne({credentials: true});
    if (!doc || !doc.auth) {
        throw new Error("No credentials found!");
    }
    return doc.auth as Credentials;
}

/**
 * Set the login credentials
 * @param {Credentials} credentials The credentials
 */
async function saveCredentials(credentials:Credentials) {
    await gmailOauthDb.deleteMany({credentials: true});
    const saved = await gmailOauthDb.insertOne({credentials: true, auth: credentials});
    console.log(`Saved credentials: ${saved.insertedId}`);
}

export default new StatSource(1000 * 60 * 5, Source.GMAIL,
    async () => {
        const stats = {
            num_unread: 0
        } as GmailStats;

        oauth2Client.setCredentials(await getCredentials());

        const gmailClient = gmail({version: "v1", auth: oauth2Client});
        const inboxLabel = await gmailClient.users.labels.get({
            userId: "me",
            id: "INBOX"
        });

        if (typeof inboxLabel.data.messagesUnread === "number") {
            stats.num_unread = inboxLabel.data.messagesUnread;
        } else {
            console.error(`No labels found. ${inboxLabel}`);
        }

        return {
            stats: {
                inbox: stats
            }
        };
    },
    async (req, res) => {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: SCOPES,
        });
        res.redirect(authUrl);
    },
    async (req, res) => {
        const {code} = req.query;

        try {
            // Exchange the authorization code for access and refresh tokens
            const {tokens} = await oauth2Client.getToken(code);

            // Set the credentials on the OAuth2 client
            await saveCredentials(tokens);

            // Redirect the user to the main page
            res.send("<!DOCTYPE html><script>close();</script>You can now close this window!");
        } catch (error) {
            console.error("Error getting access token:", error);
            res.status(500).send("Error getting access token.");
        }
    }
);
