import * as functions from "firebase-functions";
import {debug, error, info, warn} from "firebase-functions/logger";

import prodConfig from "./prodConfig.js";
import twitter from "./sources/twitter.js";
import trello from "./sources/trello.js";
import gmail from "./sources/gmail.js";
import fitbit from "./sources/fitbit.js";
import stocks from "./sources/stocks.js";
import strava from "./sources/strava.js";
import weather from "./sources/weather.js";
import tscraper from "./sources/tscraper.js";

import express from "express";
import cors from "cors";
import {deleteAll, StatSource} from "./StatSource.js";
import {getDb} from "./db.js";
import {DateTime, Duration} from "luxon";
import {Source} from "./charts/chart.js";
import {charts} from "./charts/chartDefinitions.js";
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
    const sourcesCopy = sources.filter((source) => source !== "TIME" || process.env.TIME_SOURCE_ENABLED === "true");
    res.send({sources: sourcesCopy});
    debug("Getting sources", {
        route: "/sources",
        location: "route",
        sourcesCopy
    });
});

app.get("/charts", async (req, res) => {
    res.send({charts});
    debug("Getting chartDefinitions", {
        route: "/chartDefinitions",
        location: "route",
        charts: JSON.stringify(charts).slice(0, 100)
    });
});

app.delete("/stats/:source", async (req, res) => {
    warn(`Deleting all stats for ${req.params.source}`, {
        route: "/stats/:source",
        location: "route",
    });
    await deleteAll(req.params.source);
});

/**
 * Chatgpt made this lol
 * @param {number} numBuckets - number of buckets to generate
 * @param {Date} startDate - start date
 * @param {Date} endDate - end date
 * @return {Date[]} bucket ranges
 */
function generateBoundaries(numBuckets:number, startDate:Date, endDate:Date) {
    const boundaries = [];
    const timeDiff = endDate.getTime() - startDate.getTime();
    const interval = Math.floor(timeDiff / numBuckets);

    for (let i = 0; i < numBuckets; i++) {
        const boundary = new Date(startDate.getTime() + i * interval);
        boundaries.push(boundary);
    }

    boundaries.push(endDate);

    return boundaries;
}


app.get("/stats/:source", async (req, res) => {
    const db = await getDb();
    const aggregate = req.query.aggregate === "true";
    const delta = req.query.delta === "true";
    const buckets = aggregate ? parseInt(req.query.buckets as string) || 200 : 0;
    const sinceTime = req.query.sinceTime ? parseInt(req.query.sinceTime as string) : 0;
    const sinceUnits = req.query.sinceUnits as string;

    const source = req.params.source;
    debug(`Getting stats for ${source} (aggregate: ${aggregate}, buckets: ${buckets})`, {
        route: "/stats/:source",
        location: "route",
        source,
        aggregate,
        delta,
        buckets,
        sinceTime,
        sinceUnits
    });

    if (!sources.includes(source)) {
        warn(`Invalid source: ${source}`);
        res.status(400).send({error: "Invalid source"});
        return;
    }

    const relativeTime = req.query.relativeTime === "true";

    let results: any[];
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


        let pipelineStart: any[] = [];

        let start: Date | undefined = undefined;
        if (sinceTime && sinceUnits) {
            start = DateTime.now().minus(Duration.fromObject({[sinceUnits]: sinceTime})).toJSDate();

            pipelineStart = [
                {
                    $match: {
                        timestamp: {
                            $gte: start,
                            // $lte: new Date(finish)
                        }
                    }
                },
            ];

            debug("Timeboxing aggregate pipeline", {
                route: "/stats/:source",
                location: "route",
                pipelineStart,
                sinceTime,
                sinceUnits
            });
        } else if (!relativeTime) {
            start = (await db.collection(source.toLowerCase()).find().sort({timestamp: 1}).limit(1).toArray())[0].timestamp;
        }

        let pipeline = [
            ...pipelineStart,
            {
                $sample: {
                    size: 10000
                }
            },
            relativeTime ? {
                $sort: {timestamp: -1}
            } :/* {
                $bucketAuto: {
                    groupBy: "$timestamp",
                    buckets: buckets,
                    output: outputObject
                }
            }*/ {
                    $bucket: {
                        groupBy: "$timestamp",
                        boundaries: generateBoundaries(buckets, start as Date, new Date()),
                        output: outputObject
                    }
                }
        ].filter(Boolean);

        if (delta) {
            pipeline = [
                ...pipelineStart,
                {
                    $sort: {timestamp: -1}
                },
                {
                    $group: {
                        _id: {$dateToString: {format: "%Y-%m-%d", date: "$timestamp"}},
                        lastDocument: {$last: "$$ROOT"}
                    }
                },
                {
                    $project: {
                        _id: "$lastDocument.timestamp",
                        date: "$_id",
                        stats: "$lastDocument.stats",
                        timestamp: "$lastDocument.timestamp",
                        metadata: "$lastDocument.metadata",
                    }
                },
                {
                    $sort: {
                        "timestamp": 1
                    }
                },
                {
                    $project: outputObject
                }
            ];
        }

        debug("Running aggregate pipeline", {
            route: "/stats/:source",
            location: "route",
            pipeline: pipeline // JSON.stringify(pipeline).slice(0, 1000)
        });
        const aggregateResult = await db.collection(source.toLowerCase()).aggregate(pipeline).toArray();
        debug(`aggregateResult returned Got ${aggregateResult.length} results`, {
            route: "/stats/:source",
            location: "route",
            results: aggregateResult.length
        });

        results = relativeTime ? aggregateResult : aggregateResult.map((result) => {
            const stats = {} as any;
            for (const [key, value] of Object.entries(result)) {
                if (key === "_id") continue;

                const [sourceKey, subKey] = key.split(":");
                if (!stats[sourceKey]) stats[sourceKey] = {};
                stats[sourceKey][subKey] = value;
            }
            return {stats: {stats}, timestamp: result._id.min ?? result._id};
        });
    } else {
        results = await db.collection(source.toLowerCase()).find({}).sort({timestamp: -1}).toArray();
        debug(`Got ${results.length} results`, {
            route: "/stats/:source",
            location: "route",
            results: results.length
        });
    }

    const resultsCloned = JSON.parse(JSON.stringify(results));

    const stats = results.map((result: any, idx, results: any)=> {
        const stats = result.stats.stats;
        if (delta) {
            Object.entries(stats).forEach(([key, value]: [string, any]) => {
                if (!value) return;
                Object.entries(value).forEach(([subKey, subValue]: [string, any]) => {
                    if (idx === 0) {
                        stats[key][subKey] = 0;
                        return;
                    }
                    const previous = resultsCloned[idx - 1].stats.stats[key][subKey];
                    stats[key][subKey] = (subValue ?? 0) - (previous ?? 0);
                });
            });
        }
        return ({
            stats,
            timestamp: result.timestamp
        });
    });

    const series = {} as {[key: string]: string[]};

    const addStatToSeries = (stat: { stats: any; timestamp?: any; }) => {
        Object.entries(stat.stats).forEach(([key]) => {
            if (key === "_id") return;
            series[key] = [...new Set(Object.keys(stat.stats[key]).concat(series[key] ?? []))];
        });
    };

    if (relativeTime) {
        for (const stat of stats) {
            addStatToSeries(stat);
        }
    } else {
        if (results[0]) {
            addStatToSeries(results[0].stats);
        }
    }

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
    trello,
    gmail,
    fitbit,
    stocks,
    strava,
    weather,
    tscraper
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
        const timeUntilNext = await checkAndRefresh(statSource);
        debug(`Source ${statSource.source} next update in ${timeUntilNext / 1000} seconds`, {
            location: "checkForUpdates",
            source: statSource.source,
            timeUntilNext
        });
    }
}

export const api = functions.https.onRequest(app);
// noinspection JSUnusedGlobalSymbols
export const updateStats = functions.runWith({
    memory: "2GB",
    timeoutSeconds: 60 * 3,
}).pubsub.schedule("every 5 minutes").onRun(checkForUpdates);
