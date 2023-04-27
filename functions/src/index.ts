import * as functions from "firebase-functions";

import {config} from "dotenv";
import prodConfig from "./prodConfig.js";
config();
prodConfig();

import twitter from "./sources/twitter.js";
import time from "./sources/timeSource.js";
import trello from "./sources/trello.js";
import gmail from "./sources/gmail.js";

import express from "express";
import cors from "cors";
import {Source, StatSource} from "./StatSource.js";
import {getDb} from "./db.js";

const app = express();

const sources = Object.keys(Source);

app.use(cors({origin: process.env.CORS_ORIGIN}));

app.get("/", async (req, res) => {
    res.send("/");
});

app.get("/sources", async (req, res) => {
    res.send({sources});
});

app.get("/stats/:source", async (req, res) => {
    const db = await getDb();

    const source = req.params.source;

    if (!sources.includes(source)) {
        res.status(400).send({error: "Invalid source"});
        return;
    }

    const results = await db.collection(source.toLowerCase()).find({}).sort({timestamp: -1}).toArray();
    res.send({
        stats: results.map((result) => ({stats: result.stats.stats, timestamp: result.timestamp})),
        series: results.length ? Object.entries(results[0].stats.stats).reduce((acc, [key]) => {
            acc[key] = Object.keys(results[0].stats.stats[key]);
            return acc;
        }, {} as { [key: string]: string[] }) : {}
    });
});

app.get("/refresh", async (req, res) => {
    await checkForUpdates();
    res.send("ok");
});

const statSources = [
    twitter,
    time,
    trello,
    gmail
];

/**
 * Get the latest stats for a source
 * @param {Source} source
 */
async function latestStats(source: Source) {
    const db = await getDb();
    const results = await db.collection(source.toLowerCase()).find({}).sort({timestamp: -1}).limit(1).toArray();
    return results[0];
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
    console.log(`Source ${statSource.source} updated ${elapsedTimeSinceLastUpdate / 1000}/${refreshTime / 1000} seconds ago (${doRefresh ? "refreshing" : "not refreshing"})`);
    if (doRefresh) {
        await statSource.refreshStats();
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

async function checkForUpdates() {
    for (const statSource of statSources) {
        let timeUntilNext = await checkAndRefresh(statSource);
        console.log(`Next update for ${statSource.source} in ${timeUntilNext / 1000} seconds`);
        setTimeout(async () => {
            // noinspection InfiniteLoopJS
            while (true) { // eslint-disable-line no-constant-condition
                timeUntilNext = await checkAndRefresh(statSource);
                console.log(`Next update for ${statSource.source} in ${timeUntilNext / 1000} seconds`);
                await sleep(timeUntilNext);
            }
        }, timeUntilNext);
    }
}

export const api = functions.https.onRequest(app);
// noinspection JSUnusedGlobalSymbols
export const updateStats = functions.pubsub.schedule("every 5 minutes").onRun(checkForUpdates);
