import prodConfig from "../prodConfig.js";
import {Source, StatSource} from "../StatSource.js";
import fetch from "node-fetch";
import {debug, info} from "firebase-functions/logger";

prodConfig();

type StockStats = {
    spy: StockStat;
};

type StockStat = {
    open: number;
    high: number;
    low: number;
    close: number;
}

export default new StatSource(1000 * 60 * 60, Source.STOCKS,
    async () => {
        const stats = {
            spy: {
                open: 0,
                high: 0,
                low: 0,
                close: 0
            }
        } as StockStats;

        debug("stock stats", {
            location: "stocks.fetch",
            stats
        });

        const dateStr = (new Date()).toISOString().split("T")[0];
        const url = `https://api.polygon.io/v1/open-close/SPY/${dateStr}?adjusted=true&apiKey=${process.env.POLYGON_API_KEY}`;
        const req = await fetch(url);
        const resp = await req.json() as { status: string } & StockStat;

        if (resp?.status === "OK") {
            const {open, high, low, close} = resp as StockStat;

            stats.spy = {
                open,
                high,
                low,
                close
            };

            return {
                stats
            };
        } else {
            info("failed to fetch stock stats", {
                location: "stocks.fetch",
                resp
            });
            return null;
        }
    },
    async (req, res) => {
        res.status(204).end();
    },
    async (req, res) => {
        res.status(204).end();
    }
);

