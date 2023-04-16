import {config} from "dotenv";
config();

import twitter from "./sources/twitter";
import testSource from "./sources/timeSource";

import express from "express";
import db from "./db";
import cors from "cors";
import {source} from "./StatSource";

const app = express();

const sources:source[] = ["twitter", "time"];

app.use(cors());

app.get("/api/sources", async (req, res) => {
    res.send({sources});
});

// respond with "hello world" when a GET request is made to the homepage
app.get("/api/stats/:source", async (req, res) => {
    const source = req.params.source;

    const results = await db.collection(source).find({}).toArray();
    res.send({
        stats: results.map((result) => ({stats: result.stats.stats, timestamp: result.timestamp})),
        series: results.length ? Object.keys(results[0].stats.stats) : []
    });
    // {"timestamp": {$gt: new Date(new Date().setHours(22, 15, 13))}}
});

app.get("/login/twitter", async (req, res) => {
    await twitter.loginFunction(req, res);
});

app.get("/callback/twitter", async (req, res) => {
    await twitter.callbackFunction(req, res);
});

app.listen(3000);

const statSources = [
    twitter,
    testSource
];

statSources.forEach((source) => {
    // noinspection JSIgnoredPromiseFromCall
    source.refreshStats();
    setInterval(() => {
        // noinspection JSIgnoredPromiseFromCall
        source.refreshStats();
    }, source.refreshFrequency);
});
