import * as functions from "firebase-functions";
import {debug, error, info, warn} from "firebase-functions/logger";

import prodConfig from "./prodConfig.js";
import twitter from "./sources/twitter.js";
import time from "./sources/timeSource.js";
import trello from "./sources/trello.js";
import gmail from "./sources/gmail.js";
import fitbit from "./sources/fitbit.js";
import stocks from "./sources/stocks.js";
import strava from "./sources/strava.js";

import express from "express";
import cors from "cors";
import {deleteAll, Source, StatSource} from "./StatSource.js";
import {getDb} from "./db.js";

prodConfig();

const app = express();

const sources = Object.keys(Source);

app.use(cors({origin: process.env.CORS_ORIGIN}));

const apiKey = process.env.NEXT_PUBLIC_API_KEY;

const checkAuthorization: express.RequestHandler = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization || req.query.apiKey;

    if (!authHeader) {
        return res.status(401).json({error: "Authorization header is missing"});
    }

    // noinspection UnnecessaryLocalVariableJS
    const token = authHeader; // .split(" ")[1];

    if (token !== apiKey) {
        return res.status(401).json({error: "Invalid API key"});
    }

    next();
};

app.use(checkAuthorization);


app.get("/sources", async (req, res) => {
    res.send({sources});
    debug("Getting sources", {
        route: "/sources",
        location: "route",
        sources
    });
});

app.delete("/stats/:source", async (req, res) => {
    warn(`Deleting all stats for ${req.params.source}`, {
        route: "/stats/:source",
        location: "route",
    });
    await deleteAll(req.params.source);
});

app.get("/stats/:source", async (req, res) => {
    const db = await getDb();
    const aggregate = req.query.aggregate === "true";
    const buckets = aggregate ? parseInt(req.query.buckets as string) || 200 : 0;

    const source = req.params.source;
    debug(`Getting stats for ${source} (aggregate: ${aggregate}, buckets: ${buckets})`, {
        route: "/stats/:source",
        location: "route",
        source,
        aggregate,
        buckets
    });

    if (!sources.includes(source)) {
        warn(`Invalid source: ${source}`);
        res.status(400).send({error: "Invalid source"});
        return;
    }

    let results: any;
    if (aggregate) {
        const latest = await latestStats(source);

        if (!latest) {
            error(`No latest stat found for ${source}`, {
                route: "/stats/:source",
                location: "route",
                source
            });
            res.send({stats: [], series: []});
            return;
        }

        const outputObject = {} as any;
        for (const [key, value] of Object.entries(latest.stats.stats)) {
            if (!value) continue;
            for (const subKey of Object.keys(value)) {
                outputObject[`${key}:${subKey}`] = {"$avg": `$stats.stats.${key}.${subKey}`};
            }
        }

        const pipeline = [
            {
                $sample: {
                    size: 10000
                }
            },
            {
                $bucketAuto: {
                    groupBy: "$timestamp",
                    buckets: buckets,
                    output: outputObject
                }
            }
        ];

        debug("Running aggregate pipeline", {
            route: "/stats/:source",
            location: "route",
            pipeline
        });
        const aggregateResult = await db.collection(source.toLowerCase()).aggregate(pipeline).toArray();
        debug(`aggregateResult returned Got ${aggregateResult.length} results`, {
            route: "/stats/:source",
            location: "route",
            results: aggregateResult.length
        });

        results = aggregateResult.map((result) => {
            const stats = {} as any;
            for (const [key, value] of Object.entries(result)) {
                if (key === "_id") continue;

                const [sourceKey, subKey] = key.split(":");
                if (!stats[sourceKey]) stats[sourceKey] = {};
                stats[sourceKey][subKey] = value;
            }
            return {stats: {stats}, timestamp: result._id.min};
        });
    } else {
        results = await db.collection(source.toLowerCase()).find({}).sort({timestamp: -1}).toArray();
        debug(`Got ${results.length} results`, {
            route: "/stats/:source",
            location: "route",
            results: results.length
        });
    }

    const stats = results.map((result: any) => ({stats: result.stats.stats, timestamp: result.timestamp}));

    const series = results.length ? Object.entries(results[0].stats.stats).reduce((acc, [key]) => {
        if (key === "_id") return acc;
        acc[key] = Object.keys(results[0].stats.stats[key]);
        return acc;
    }, {} as { [key: string]: string[] }) : {};

    debug(`Returning ${stats.length} stats`, {
        route: "/stats/:source",
        location: "route",
        stats: stats.length,
        series
    });

    res.send({
        stats,
        series
    });
});

app.post("/refresh", async (req, res) => {
    await checkForUpdates();
    info("Refreshed all sources", {
        route: "/refresh",
        location: "route"
    });
    res.send("ok");
});

const statSources = [
    twitter,
    time,
    trello,
    gmail,
    fitbit,
    stocks,
    strava
];

/**
 * Get the latest stats for a source
 * @param {string} source
 */
async function latestStats(source: string) {
    const db = await getDb();
    const results = await db.collection(source.toLowerCase()).find({}).sort({timestamp: -1}).limit(1).toArray();
    if (!results || !results.length) {
        error(`No results found for ${source}`, {
            location: "latestStats",
            source
        });
        return null;
    }
    debug(`Got latest stats for ${source}`, {
        location: "latestStats",
        source,
        results: results && results[0]
    });
    return results && results[0];
}

/**
 * Check if a stat source needs to be refreshed, and refresh it if it does
 * @param {StatSource} statSource The stat source to check
 * @return {Promise<number>} The time in ms until the next refresh (call this function again)
 */
async function checkAndRefresh(statSource: StatSource) {
    const variance = Math.min(acceptableTimeVariance, statSource.refreshFrequency / 2);

    const latest = await latestStats(statSource.source);
    const latestTimestamp = latest ? latest.timestamp : 0;
    const now = new Date();
    const elapsedTimeSinceLastUpdate = now.getTime() - latestTimestamp;
    const refreshTime = statSource.refreshFrequency;
    const doRefresh = elapsedTimeSinceLastUpdate + variance > refreshTime;

    debug(`Source ${statSource.source} updated ${elapsedTimeSinceLastUpdate / 1000}/${refreshTime / 1000} seconds ago (${doRefresh ? "refreshing" : "not refreshing"})`, {
        location: "checkAndRefresh",
        source: statSource.source,
        elapsedTimeSinceLastUpdate,
        refreshTime,
        doRefresh,
        now
    });

    if (doRefresh) {
        try {
            await statSource.refreshStats();
        } catch (e) {
            error(`Error refreshing ${statSource.source}: ${e}`, {
                location: "checkAndRefresh",
                source: statSource.source,
                error: e
            });
        }
        return refreshTime;
    } else {
        return refreshTime - elapsedTimeSinceLastUpdate;
    }
}

const acceptableTimeVariance = 1000 * 10;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

for (const statSource of statSources) {
    statSource.setupRoutes(app);
}

/**
 * Check for updates for all stat sources
 */
async function checkForUpdates() {
    debug("Checking for updates", {
        location: "checkForUpdates"
    });
    if (process.env.SKIP_UPDATES === "true") {
        info("Skipping updates", {
            location: "checkForUpdates"
        });
        return;
    }

    for (const statSource of statSources) {
        let timeUntilNext = await checkAndRefresh(statSource);
        debug(`Source ${statSource.source} next update in ${timeUntilNext / 1000} seconds`, {
            location: "checkForUpdates",
            source: statSource.source,
            timeUntilNext
        });
        setTimeout(async () => {
            // noinspection InfiniteLoopJS
            while (true) { // eslint-disable-line no-constant-condition
                timeUntilNext = await checkAndRefresh(statSource);
                debug(`Source ${statSource.source} next update in ${timeUntilNext / 1000} seconds`, {
                    location: "checkForUpdates",
                    source: statSource.source,
                    timeUntilNext
                });
                await sleep(timeUntilNext);
            }
        }, timeUntilNext);
    }
}

export const api = functions.https.onRequest(app);
// noinspection JSUnusedGlobalSymbols
export const updateStats = functions.pubsub.schedule("every 5 minutes").onRun(checkForUpdates);
