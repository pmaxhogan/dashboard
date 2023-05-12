import prodConfig from "../prodConfig.js";
prodConfig();
import {StatSource} from "../StatSource.js";
import {getOauthDb} from "../db.js";
import fetch from "node-fetch";
import {debug, error, warn} from "firebase-functions/logger";
import {DateTime} from "luxon";
import {Source} from "../chart.js";


/**
 * Get the login credentials
 */
async function getLoginCredentials() {
    const stravaOauthDb = (await getOauthDb()).collection("strava");
    const doc = await stravaOauthDb.findOne({credentials: true});
    if (!doc || !doc.accessToken || !doc.refreshToken) {
        error("No credentials found!", {
            location: "strava.getLoginCredentials"
        });
        throw new Error("No credentials found!");
    }
    debug(`getLoginCredentials: doc=${doc}`, {
        location: "strava.getLoginCredentials",
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
    const stravaOauthDb = (await getOauthDb()).collection("strava");
    const res = await stravaOauthDb.deleteMany({credentials: true});
    await stravaOauthDb.insertOne({accessToken, refreshToken, credentials: true});
    debug("setLoginCredentials", {
        location: "strava.setLoginCredentials",
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
async function fetchRefreshIfNeeded(url: string, opts?: any, dontRefresh = false): Promise<any> {
    const {accessToken} = await getLoginCredentials();

    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers["Authorization"] = `Bearer ${accessToken}`;

    const req = await fetch(url, opts);
    if (req.status === 401) {
        warn("401, refreshing", {
            location: "strava.fetchRefreshIfNeeded",
            url,
            opts
        });

        if (dontRefresh) {
            error("401, refreshing, but already refreshed", {
                location: "strava.fetchRefreshIfNeeded",
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

type StravaStats = {
    rides: StravaRideStats,
    biggest: StravaBiggestStats,
    ytd: StravaTimeStats,
    allTime: StravaTimeStats,
    following: StravaFollowingStats
};

type StravaRideStats = {
    distance: number,
    total_elevation_gain: number,
    achievement_count: number,
    average_speed: number,
    max_speed: number,
    average_watts: number,
};

type StravaBiggestStats = {
    distance: number,
    climb: number,
}

type StravaTimeStats = {
    time: number,
    distance: number,
    elevation: number,
    count: number,
}

type StravaFollowingStats = {
    followers: number,
    following: number,
}


/**
 * Refresh the access token
 */
async function refresh() {
    const req = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: process.env.STRAVA_CLIENT_ID as string,
            client_secret: process.env.STRAVA_CLIENT_SECRET as string,
            refresh_token: (await getLoginCredentials()).refreshToken
        }).toString()
    });
    const json = await req.json() as { access_token: string, refresh_token: string };
    debug("refresh", {
        location: "strava.refresh",
        json
    });

    await setLoginCredentials(json.access_token, json.refresh_token);
}


export default new StatSource(1000 * 60 * 60 * 24 - (1000 * 60), Source.STRAVA,
    async () => {
        const now = DateTime.now().setZone(process.env.TIME_ZONE as string);
        const yesterday = now.minus({days: 1});

        const startOfDay = yesterday.startOf("day").toUnixInteger();
        const endOfDay = yesterday.endOf("day").toUnixInteger();

        const baseStr = `https://www.strava.com/api/v3/athlete/activities?after=${startOfDay}&before=${endOfDay}`;

        debug("refreshing strava", {
            location: "strava.fetch",
            startOfDay,
            endOfDay,
            baseStr
        });

        const req = await fetchRefreshIfNeeded(baseStr);

        const activities = await req.json() as any[];

        const metersToMiles = (meters: number) => meters * 0.000621371;
        const metersToFeet = (meters: number) => meters * 3.28084;
        const metersPerSecondToMilesPerHour = (mps: number) => mps * 2.23694;

        const objs = activities.filter((a) => a.type === "Ride").map((activity) => ({
            distance: metersToMiles(activity.distance),
            total_elevation_gain: metersToFeet(activity.total_elevation_gain),
            achievement_count: activity.achievement_count,
            average_speed: metersPerSecondToMilesPerHour(activity.average_speed),
            max_speed: metersPerSecondToMilesPerHour(activity.max_speed),
            average_watts: activity.average_watts,
        } as StravaRideStats));
        const result = {
            rides: objs.reduce((acc, cur) => ({
                distance: acc.distance + cur.distance,
                total_elevation_gain: acc.total_elevation_gain + cur.total_elevation_gain,
                achievement_count: acc.achievement_count + cur.achievement_count,
                average_speed: cur.average_speed,
                max_speed: cur.max_speed,
                average_watts: cur.average_watts,
            }), {distance: 0, total_elevation_gain: 0, achievement_count: 0, average_speed: 0, max_speed: 0, average_watts: 0})
        } as StravaStats;

        const profileInfo = await fetchRefreshIfNeeded("https://www.strava.com/api/v3/athlete");
        const profile = await profileInfo.json();

        const stats = await fetchRefreshIfNeeded("https://www.strava.com/api/v3/athletes/45095733/stats");
        const statsObj = await stats.json();

        result.biggest = {
            distance: metersToMiles(statsObj.biggest_ride_distance),
            climb: metersToFeet(statsObj.biggest_climb_elevation_gain)
        };

        result.ytd = {
            count: statsObj.ytd_ride_totals.count,
            distance: metersToMiles(statsObj.ytd_ride_totals.distance),
            time: statsObj.ytd_ride_totals.moving_time,
            elevation: metersToFeet(statsObj.ytd_ride_totals.elevation_gain)
        };

        result.allTime = {
            count: statsObj.all_ride_totals.count,
            distance: metersToMiles(statsObj.all_ride_totals.distance),
            time: statsObj.all_ride_totals.moving_time,
            elevation: metersToFeet(statsObj.all_ride_totals.elevation_gain)
        };

        result.following = {
            followers: profile.follower_count,
            following: profile.friend_count
        };

        debug("strava stats", {
            location: "strava.fetch",
            result,
        });

        debug("test", {
            location: "strava.fetch",
            statsObj
        });

        return {
            stats: result
        };
    },
    async (req, res) => {
        const redirectUri = `${process.env.API_BASE}/callback/strava?apiKey=${process.env.NEXT_PUBLIC_API_KEY}`;
        const clientId = process.env.STRAVA_CLIENT_ID;
        const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&\
approval_prompt=auto&scope=activity:read_all,profile:read_all,read_all`;

        debug("redirecting to strava", {
            location: "strava.redirect",
            url
        });

        res.redirect(url);
    },
    async (req, res) => {
        // Extract state and code from query string
        const {code} = req.query;

        debug("strava callback", {
            location: "strava.callback",
            code
        });

        const tokenReq = await fetch("https://www.strava.com/api/v3/oauth/token", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: process.env.STRAVA_CLIENT_ID as string,
                client_secret: process.env.STRAVA_CLIENT_SECRET as string,
                code: code as string,
                grant_type: "authorization_code",
            })
        });
        const tokenJson = await tokenReq.json();
        // eslint-disable-next-line camelcase
        const {access_token, refresh_token, expires_in, athlete} = tokenJson as {
            access_token: string,
            refresh_token: string,
            expires_in: string,
            athlete: any
        };

        debug("strava callback token", {
            location: "strava.callback",
            access_token, // eslint-disable-line camelcase
            refresh_token, // eslint-disable-line camelcase
            expires_in, // eslint-disable-line camelcase
            athlete // eslint-disable-line camelcase,
        });

        await setLoginCredentials(access_token, refresh_token);

        res.status(200).send("OK");
    }
);

