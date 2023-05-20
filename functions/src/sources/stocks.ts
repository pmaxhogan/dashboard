import prodConfig from "../prodConfig.js";
import {StatSource} from "../StatSource.js";
import fetch from "node-fetch";
import {debug, info} from "firebase-functions/logger";
import oauthSuccess from "../oauthSuccess.js";
import {Source} from "../charts/chart.js";

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

type ApiResult = {
    T: string;
    v: number;
    vw: number;
    o: number;
    c: number;
    h: number;
    l: number;
    t: number;
    n: number;
};

type ApiData = {
    ticker: string;
    queryCount: number;
    resultsCount: number;
    adjusted: boolean;
    results: ApiResult[];
    status: string;
    request_id: string;
    count: number;
};


export default new StatSource(1000 * 60 * 60 * 24 - (1000 * 60), Source.STOCKS,
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

        const url = `https://api.polygon.io/v2/aggs/ticker/${process.env.POLYGON_TICKER}/prev?adjusted=true&apiKey=${process.env.POLYGON_API_KEY}`;
        const req = await fetch(url);
        debug("stock stats", {
            location: "stocks.fetch",
            url
        });
        const resp = await req.json() as ApiData;
        debug("stock stats response", {
            location: "stocks.fetch",
            resp
        });

        if (resp?.status === "OK") {
            const {o: open, h: high, l: low, c: close} = resp.results[0];

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
        return oauthSuccess(req, res);
    },
    async (req, res) => {
        return oauthSuccess(req, res);
    }
);

