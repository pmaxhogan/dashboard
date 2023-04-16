// import twitter from "./sources/twitter";
import testSource from "./sources/testSource";

import express from "express";
import db from "./db";
import cors from "cors";
import {source} from "./StatSource";

const app = express();

const sources = ["twitter", "test"] as source[];

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
        series: Object.keys(results[0].stats.stats)
    });
    // {"timestamp": {$gt: new Date(new Date().setHours(22, 15, 13))}}
});
app.listen(3000);

const statSources = [
    // twitter,
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
