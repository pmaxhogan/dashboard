import prodConfig from "../prodConfig.js";
import {Source, StatSource} from "../StatSource.js";
import {getOauthDb} from "../db.js";
import crypto from "node:crypto";
import fetch from "node-fetch";
import {debug, error, warn} from "firebase-functions/logger";
import {DateTime} from "luxon";

prodConfig();

const scope = "activity cardio_fitness electrocardiogram heartrate location nutrition oxygen_saturation profile respiratory_rate settings sleep social temperature weight";

type SleepBreathingValues = {
    deep: number;
    rem: number;
    light: number;
    full: number;
}

type SleepValues = {
    deep: number;
    light: number;
    rem: number;
    wake: number;
}

type HrvValues = {
    dailyRmssd: number;
    deepRmssd: number;
}

type ActiveMinutesValues = {
    fatBurn: number;
    cardio: number;
    peak: number;
}

type FitbitStats = {
    sleep: SleepValues;
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
}

const callbackUri = `${process.env.API_BASE}/callback/fitbit`;
const authHeader = `Basic ${Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString("base64")}`;

/**
 * Login verifier
 * @param {string} state The state parameter
 */
async function checkState(state: string) {
    debug(`checkState: state=${state}`, {
        location: "fitbit.checkState",
        state
    });
    const fitbitOauthDb = (await getOauthDb()).collection("fitbit");
    const doc = await fitbitOauthDb.findOne({state});
    debug(`checkState: doc=${doc}`, {
        location: "fitbit.checkState",
        doc
    });
    return doc !== null;
}

/**
 * Login verifier
 * @param {string} state The state parameter
 */
async function addState(state: string) {
    debug(`addState: state=${state}`, {
        location: "fitbit.addState",
        state
    });
    const fitbitOauthDb = (await getOauthDb()).collection("fitbit");
    const res = await fitbitOauthDb.deleteMany({state: {$ne: state}});
    debug(`addState: delete num=${res.deletedCount}`, {
        location: "fitbit.addState",
        numDeleted: res.deletedCount
    });
    await fitbitOauthDb.insertOne({state});
}

/**
 * Get the login credentials
 */
async function getLoginCredentials() {
    const fitbitOauthDb = (await getOauthDb()).collection("fitbit");
    const doc = await fitbitOauthDb.findOne({credentials: true});
    if (!doc || !doc.accessToken || !doc.refreshToken) {
        error("No credentials found!", {
            location: "fitbit.getLoginCredentials"
        });
        throw new Error("No credentials found!");
    }
    debug(`getLoginCredentials: doc=${doc}`, {
        location: "fitbit.getLoginCredentials",
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
    const fitbitOauthDb = (await getOauthDb()).collection("fitbit");
    const res = await fitbitOauthDb.deleteMany({credentials: true});
    await fitbitOauthDb.insertOne({accessToken, refreshToken, credentials: true});
    debug("setLoginCredentials", {
        location: "fitbit.setLoginCredentials",
        deletedCount: res.deletedCount,
        accessToken,
        refreshToken
    });
}

/**
 * Fetch, refreshing if needed
 * @param {string} url
 * @param {any} opts
 * @param {boolean} dontRefresh
 */
async function fetchRefreshIfNeeded(url: string, opts: any, dontRefresh = false): Promise<any> {
    const req = await fetch(url, opts);
    if (req.status === 401) {
        warn("401, refreshing", {
            location: "fitbit.fetchRefreshIfNeeded",
            url,
            opts
        });

        if (dontRefresh) {
            error("401, refreshing, but already refreshed", {
                location: "fitbit.fetchRefreshIfNeeded",
                url,
                opts,
                status: req.status
            });
            return null;
        } else {
            await refresh();
            return await fetchRefreshIfNeeded(url, opts, true);
        }
    }
    return req;
}


/**
 * Refresh the access token
 */
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
    const json = await req.json() as { access_token: string, refresh_token: string };
    debug("refresh", {
        location: "fitbit.refresh",
        json
    });
    await setLoginCredentials(json.access_token, json.refresh_token);
}

const yesterdayAsStr = () => {
    const now = DateTime.now().setZone(process.env.TIME_ZONE);
    const yesterday = now.minus({days: 1});
    return yesterday.toFormat("yyyy-MM-dd");
};

export default new StatSource(1000 * 60 * 60 * 24 - (1000 * 60), Source.FITBIT,
    async () => {
        const {accessToken} = await getLoginCredentials();

        const authHeader = {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        };

        const dateStr = yesterdayAsStr();

        debug("refreshing fitbit", {
            location: "fitbit.fetch",
            yesterdayStr: dateStr
        });

        const baseStr = "https://api.fitbit.com/1/user/-";

        const endpoints = [
            `${baseStr}/br/date/${dateStr}/all.json`,
            `${baseStr}/cardioscore/date/${dateStr}.json`,
            `${baseStr}/hrv/date/${dateStr}.json`,
            `${baseStr}/temp/skin/date/${dateStr}.json`,
            `${baseStr}/activities/heart/date/${dateStr}/1d.json`,
            `${baseStr}/sleep/date/${dateStr}.json`
        ];

        const promises = endpoints.map((endpoint) => fetchRefreshIfNeeded(endpoint, authHeader).then((response) => response.json()));

        const results = await Promise.all(promises);

        if (results.some((result) => result.success === false)) {
            error("fitbit data failed", {
                location: "fitbit.fetch",
                results
            });
            return null;
        }

        const [breathing, vo2Max, hrv, skinTemp, heart, sleep] = results;

        debug("fitbit data", {
            location: "fitbit.fetch",
            breathing, vo2Max, hrv, skinTemp, heart
        });

        const breathingValues = breathing.br[0].value;
        const {dailyRmssd, deepRmssd} = hrv.hrv[0].value;

        const sleepBreathing = {
            deep: breathingValues.deepSleepSummary.breathingRate,
            rem: breathingValues.remSleepSummary.breathingRate,
            light: breathingValues.lightSleepSummary.breathingRate,
            full: breathingValues.fullSleepSummary.breathingRate
        };
        const vo2MaxValue = parseInt(vo2Max?.cardioScore[0]?.value?.vo2Max);
        const skinTempValue = skinTemp.tempSkin[0].value.nightlyRelative;
        const hrvValues = {
            dailyRmssd,
            deepRmssd
        };

        const rhrValue = heart["activities-heart"][0].value.restingHeartRate;
        const zones = heart["activities-heart"][0].value.heartRateZones;
        const activeMinutes = {
            fatBurn: zones.find((zone: any) => zone.name === "Fat Burn").minutes,
            cardio: zones.find((zone: any) => zone.name === "Cardio").minutes,
            peak: zones.find((zone: any) => zone.name === "Peak").minutes,
        };

        const sleepData = sleep.summary.stages;

        const stats = {
            sleep: sleepData,
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
        } as FitbitStats;

        debug("fitbit stats", {
            location: "fitbit.fetch",
            stats
        });

        return {
            stats
        };
    },
    async (req, res) => {
        const state = crypto.randomBytes(16).toString("hex");

        await addState(state);

        const url = `https://www.fitbit.com/oauth2/authorize?client_id=${process.env.FITBIT_CLIENT_ID}&response` +
            `_type=code&scope=${encodeURIComponent(scope)}&state=${state}&redirect_uri=${callbackUri}`;

        debug("redirecting to fitbit", {
            location: "fitbit.redirect",
            url
        });

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

        debug("fitbit callback", {
            location: "fitbit.callback",
            state,
            code
        });

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
        const {access_token, refresh_token, expires_in, user_id} = await tokenReq.json() as {
            access_token: string,
            refresh_token: string,
            expires_in: string,
            user_id: string
        };

        debug("fitbit callback token", {
            location: "fitbit.callback",
            access_token, // eslint-disable-line camelcase
            refresh_token, // eslint-disable-line camelcase
            expires_in, // eslint-disable-line camelcase
            user_id // eslint-disable-line camelcase
        });

        await setLoginCredentials(access_token, refresh_token);

        res.status(204).end();
    }
);

