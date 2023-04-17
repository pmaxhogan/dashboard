import {config} from "dotenv";
config();

import twitter from "./sources/twitter";
import testSource from "./sources/timeSource";
import trello from "./sources/trello";

import express from "express";
import db from "./db";
import cors from "cors";
import {source} from "./StatSource";

const app = express();

const sources:source[] = ["twitter", "time", "trello"];

app.use(cors({origin: process.env.CORS_ORIGIN}));

app.get("/api/sources", async (req, res) => {
    res.send({sources});
});

app.get("/api/stats/:source", async (req, res) => {
    const source = req.params.source;

    const results = await db.collection(source).find({}).sort({timestamp: -1}).limit(250).toArray();
    res.send({
        stats: results.map((result) => ({stats: result.stats.stats, timestamp: result.timestamp})),
        series: results.length ? Object.entries(results[0].stats.stats).reduce((acc, [key, value]) => {
            acc[key] = Object.keys(results[0].stats.stats[key]);
            return acc;
        }, {} as { [key: string]: string[] }) : {}
    });
});

const statSources = [
    twitter,
    testSource,
    trello
];

statSources.forEach((source) => {
    source.setupRoutes(app);

    // noinspection JSIgnoredPromiseFromCall
    source.refreshStats();
    setInterval(() => {
        // noinspection JSIgnoredPromiseFromCall
        // source.refreshStats();
    }, source.refreshFrequency);
});
app.listen(3000);
