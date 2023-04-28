import prodConfig from "../prodConfig.js";
import {Source, StatSource} from "../StatSource.js";
import {getOauthDb} from "../db.js";
import crypto from "node:crypto";

prodConfig();

const scope = "activity cardio_fitness electrocardiogram heartrate location nutrition oxygen_saturation profile respiratory_rate settings sleep social temperature weight";


// https://www.fitbit.com/oauth2/authorize?client_id=23QSR7&response_type=code&scope=${scope}&redirect_uri=${redirect_uri}&state={state}

type SleepBreathingValues = {
    deep: number;
    rem: number;
    light: number;
    full: number;
}

type HrvValues = {
    dailyRmssd: number;
    deepRmssd: number;
}

type ActiveMinutesValues = {
    belowZone: number;
    fatBurn: number;
    cardio: number;
    peak: number;
}

/* type Spo2Values = {
    avg: number;
    min: number;
    max: number;
}*/

type FitbitStats = {
    sleepBreathing: SleepBreathingValues;
    vo2Max: {
        vo2MaxValue: number;
    };
    skinTemp: {
        skinTempValue: number;
    };
    rhr: {
        rhrValue: number;
    };
    activeMinutes: ActiveMinutesValues;
    hrvValues: HrvValues;
    // spo2Values: Spo2Values;
}

const callbackUri = `${process.env.API_BASE}/callback/fitbit`;
const authHeader = `Basic ${Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString("base64")}`;

/**
 * Login verifier
 * @param {string} state The state parameter
 */
async function checkState(state: string) {
    const fitbitOauthDb = (await getOauthDb()).collection("fitbit");
    const doc = await fitbitOauthDb.findOne({state});
    return doc !== null;
}

/**
 * Login verifier
 * @param {string} state The state parameter
 */
async function addState(state: string) {
    const fitbitOauthDb = (await getOauthDb()).collection("fitbit");
    await fitbitOauthDb.deleteMany({state: {$ne: state}});
    await fitbitOauthDb.insertOne({state});
}

/**
 * Get the login credentials
 */
async function getLoginCredentials() {
    const fitbitOauthDb = (await getOauthDb()).collection("fitbit");
    const doc = await fitbitOauthDb.findOne({credentials: true});
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
    const fitbitOauthDb = (await getOauthDb()).collection("fitbit");
    await fitbitOauthDb.deleteMany({credentials: true});
    await fitbitOauthDb.insertOne({accessToken, refreshToken, credentials: true});
}

/**
 * Fetch, refreshing if needed
 * @param {string} url
 * @param {any} opts
 * @param {boolean} dontRefresh
 */
async function fetchRefreshIfNeeded(url: string, opts: any, dontRefresh = false): Promise<Response | undefined> {
    const req = await fetch(url, opts);
    if (req.status === 401 && !dontRefresh) {
        await refresh();
        return await fetchRefreshIfNeeded(url, opts, true);
    }
    return req;
}


async function refresh() {
    const req = await fetch("https://api.fitbit.com/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": authHeader
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: (await getLoginCredentials()).refreshToken
        }).toString()
    });
    const json = await req.json();
    await setLoginCredentials(json.access_token, json.refresh_token);
}

export default new StatSource(1000 * 60 * 60, Source.FITBIT,
    async () => {
        const {accessToken, refreshToken} = await getLoginCredentials();
        console.log("fitbit refresh", accessToken, refreshToken);

        const authHeader = {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        };
        // const profile = await (await fetchRefreshIfNeeded("https://api.fitbit.com/1/user/-/profile.json", authHeader))?.json();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        // date str yyyy-MM-dd
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        const breathing = await (await fetchRefreshIfNeeded(`https://api.fitbit.com/1/user/-/br/date/${yesterdayStr}/all.json`, authHeader))?.json();
        const vo2Max = await (await fetchRefreshIfNeeded(`https://api.fitbit.com/1/user/-/cardioscore/date/${yesterdayStr}.json`, authHeader))?.json();
        const hrv = await (await fetchRefreshIfNeeded(`https://api.fitbit.com/1/user/-/hrv/date/${yesterdayStr}.json`, authHeader))?.json();
        const skinTemp = await (await fetchRefreshIfNeeded(`https://api.fitbit.com/1/user/-/temp/skin/date/${yesterdayStr}.json`, authHeader))?.json();
        const heart = await (await fetchRefreshIfNeeded(`https://api.fitbit.com/1/user/-/activities/heart/date/${yesterdayStr}/1d.json`, authHeader))?.json();

        // const spo2 = await (await fetchRefreshIfNeeded(`https://api.fitbit.com/1/user/-/spo2/date/${yesterdayStr}.json`, authHeader))?.json();

        const breathingValues = breathing.br[0].value;
        const {dailyRmssd, deepRmssd} = hrv.hrv[0].value;

        const sleepBreathing = {
            deep: breathingValues.deepSleepSummary.breathingRate,
            rem: breathingValues.remSleepSummary.breathingRate,
            light: breathingValues.lightSleepSummary.breathingRate,
            full: breathingValues.fullSleepSummary.breathingRate
        };
        const vo2MaxValue = parseInt(vo2Max.cardioScore[0].value.vo2Max);
        const skinTempValue = skinTemp.tempSkin[0].value.nightlyRelative;
        const hrvValues = {
            dailyRmssd,
            deepRmssd
        };

        const rhrValue = heart["activities-heart"][0].value.restingHeartRate;
        const zones = heart["activities-heart"][0].value.heartRateZones;
        const activeMinutes = {
            belowZone: zones.find((zone: any) => zone.name === "Out of Range").minutes,
            fatBurn: zones.find((zone: any) => zone.name === "Fat Burn").minutes,
            cardio: zones.find((zone: any) => zone.name === "Cardio").minutes,
            peak: zones.find((zone: any) => zone.name === "Peak").minutes,
        };


        // const spo2Values = spo2.value;

        const stats = {
            sleepBreathing,
            vo2Max: {
                vo2MaxValue
            },
            skinTemp: {
                skinTempValue
            },
            hrvValues,
            rhr: {
                rhrValue
            },
            activeMinutes
            // spo2Values
        } as FitbitStats;


        console.log("fitbit profile", JSON.stringify(breathing.br));

        return {
            stats
        };
    },
    async (req, res) => {
        const state = crypto.randomBytes(16).toString("hex");

        await addState(state);

        const url = `https://www.fitbit.com/oauth2/authorize?client_id=${process.env.FITBIT_CLIENT_ID}&response` +
        `_type=code&scope=${encodeURIComponent(scope)}&state=${state}&redirect_uri=${callbackUri}`;

        res.redirect(url);
    },
    async (req, res) => {
        // Extract state and code from query string
        const {state, code} = req.query;
        // Check if a verifier is associated with given state
        const stateValid = await checkState(state);

        if (!state || !stateValid) {
            return res.status(400).send("You denied the app or your session expired!");
        }

        console.log("code", code);
        const tokenReq = await fetch("https://api.fitbit.com/oauth2/token", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Authorization": authHeader,
                "Content-Type": "application/x-www-form-urlencoded",

            },
            body: new URLSearchParams({
                code: code as string,
                grant_type: "authorization_code",
                redirect_uri: callbackUri,
                expires_in: "1",
            })
        });
        // eslint-disable-next-line camelcase
        const {access_token, refresh_token, expires_in, user_id} = await tokenReq.json();
        console.log("access_token", access_token, refresh_token, expires_in, user_id);

        await setLoginCredentials(access_token, refresh_token);

        res.send("<!DOCTYPE html><script>close();</script>You can now close this window!");
    }
);

