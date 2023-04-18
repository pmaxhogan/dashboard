import {config} from "dotenv";
config();

import twitter from "./sources/twitter";
import time from "./sources/timeSource";
import trello from "./sources/trello";
import gmail from "./sources/gmail";

import express from "express";
import db from "./db";
import cors from "cors";
import {source} from "./StatSource";

const app = express();

const sources:source[] = ["twitter", "time", "trello", "gmail"];

app.use(cors({origin: process.env.CORS_ORIGIN}));

app.get("/api/sources", async (req, res) => {
    res.send({sources});
});

app.get("/api/stats/:source", async (req, res) => {
    const source = req.params.source;

    const results = await db.collection(source).find({}).sort({timestamp: -1}).limit(250).toArray();
    res.send({
        stats: results.map((result) => ({stats: result.stats.stats, timestamp: result.timestamp})),
        series: results.length ? Object.entries(results[0].stats.stats).reduce((acc, [key]) => {
            acc[key] = Object.keys(results[0].stats.stats[key]);
            return acc;
        }, {} as { [key: string]: string[] }) : {}
    });
});

const statSources = [
    twitter,
    time,
    trello,
    gmail
];

statSources.forEach((source) => {
    source.setupRoutes(app);

    if (process.env[`SOURCE_IS_SENSITIVE_${source.source.toUpperCase()}`] === "true") {
        console.log(`Source ${source.source} is sensitive, not refreshing on startup`);
    } else {
        // noinspection JSIgnoredPromiseFromCall
        source.refreshStats();
    }

    setInterval(() => {
        // noinspection JSIgnoredPromiseFromCall
        source.refreshStats();
    }, source.refreshFrequency);
});
app.listen(3000);
