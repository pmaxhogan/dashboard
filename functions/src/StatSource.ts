import {getDb} from "./db.js";
import prodConfig from "./prodConfig.js";
import {debug, error, info, warn} from "firebase-functions/logger";

/*
example

debug("Getting sources", {
    route: "/sources",
    location: "route",
    sources
});*/

prodConfig();

// create like so:
// use homepage
// db.createCollection("X", {timeseries: {timeField: "timestamp", metaField: "metadata", granularity: "seconds"}})

export const deleteAll = async (colName: string) => {
    const db = await getDb();
    const collection = db.collection(colName);
    const result = await collection.deleteMany({});
    console.log(`${colName}: Deleted ${result.deletedCount} documents`);
};

export enum Source {
    TWITTER = "twitter",
    TIME = "time",
    TRELLO = "trello",
    GMAIL = "gmail",
    FITBIT = "fitbit",
    STOCKS = "stocks",
    STRAVA = "strava",
}

type RefreshFunction = () => Promise<RefreshData|null>;

interface RefreshData {
    stats: {
        [source: string]: {
            [key: string]: number;
        }
    }
}

/**
 * A class that represents a source of stats
 */
export class StatSource {
    /**
     * Create a new StatSource
     * @param {number} refreshFrequency
     * @param {Source} source
     * @param {RefreshFunction} refresh
     */
    constructor(public refreshFrequency: number, public source: Source, public refresh: RefreshFunction,
                public loginFunction: (req: any, res: any) => Promise<any>,
                public callbackFunction: (req: any, res: any) => Promise<any>,
    ) {
        const deleteAllOnStart = process.env.DELETE_ALL_ON_START === "true";

        this.refreshFrequency = refreshFrequency;
        this.source = source;
        this.refresh = refresh;
        this.loginFunction = loginFunction;
        if (deleteAllOnStart) {
            warn(`Deleting all stats for ${this.source}`, {
                location: "StatSource constructor",
                source: this.source
            });
            deleteAll(this.source).then(() => {
                info(`Deleted all stats for ${this.source}`, {
                    location: "StatSource constructor",
                    source: this.source
                });
            }).catch((e) => {
                error(`Error deleting all stats for ${this.source} ${e}`, {
                    location: "StatSource constructor",
                    source: this.source,
                    error: e
                });
            });
        }
    }

    /**
     * Refresh the stats and save them to the database
     */
    public async refreshStats(): Promise<void> {
        const db = await getDb();
        debug(`Refreshing stats for ${this.source}`, {
            location: "StatSource.refreshStats",
            source: this.source
        });
        const stats = await this.refresh();
        if (stats === null) {
            info(`Refresh: ${this.source}: Got null stats`, {
                location: "StatSource.refreshStats",
                source: this.source
            });
            return;
        }

        debug(`Got stats for ${this.source}`, {
            location: "StatSource.refreshStats",
            source: this.source,
            stats
        });

        const myColl = db.collection(this.source);
        const result = await myColl.insertOne({
            timestamp: new Date(),
            metadata: {
                source: this.source
            },
            stats
        });

        info(`Refresh: ${this.source}: Inserted stats measurement into collection with _id: ${result.insertedId}`, {
            location: "StatSource.refreshStats",
            source: this.source,
            stats,
            id: result.insertedId
        });
    }

    /**
     * Set up the routes for this source
     * @param {any} app The express app
     */
    public setupRoutes(app: any) {
        app.get(`/login/${this.source}`, async (req: any, res: any) => {
            debug(`Logging in to ${this.source}`, {
                location: "StatSource.setupRoutes",
                route: `/login/${this.source}`,
                source: this.source
            });
            try {
                await this.loginFunction(req, res);
            } catch (e) {
                error(`Error logging in to ${this.source} ${e}`, {
                    location: "StatSource.setupRoutes",
                    route: `/login/${this.source}`,
                    source: this.source,
                    error: e
                });
            }
        });

        app.get(`/callback/${this.source}`, async (req: any, res: any) => {
            debug(`Callback for ${this.source}`, {
                location: "StatSource.setupRoutes",
                route: `/callback/${this.source}`,
                source: this.source
            });
            try {
                await this.callbackFunction(req, res);
            } catch (e) {
                error(`Error in callback for ${this.source} ${e}`, {
                    location: "StatSource.setupRoutes",
                    route: `/callback/${this.source}`,
                    source: this.source,
                    error: e
                });
            }
        });
    }
}
