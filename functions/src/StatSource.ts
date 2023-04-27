import {config} from "dotenv";
import {getDb} from "./db.js";
config();

// create like so:
// use homepage
// db.createCollection("X", {timeseries: {timeField: "timestamp", metaField: "metadata", granularity: "seconds"}})

const deleteAll = async (colName: string) => {
    const db = await getDb();
    const collection = db.collection(colName);
    const result = await collection.deleteMany({});
    console.log(`Deleted ${result.deletedCount} documents`);
};

const deleteAllOnStart = process.env.DELETE_ALL_ON_START === "true";

export enum Source {
    TWITTER = "twitter",
    TIME = "time",
    TRELLO = "trello",
    GMAIL = "gmail"
}

type RefreshFunction = () => Promise<RefreshData>;

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
        this.refreshFrequency = refreshFrequency;
        this.source = source;
        this.refresh = refresh;
        this.loginFunction = loginFunction;
        if (deleteAllOnStart) deleteAll(this.source);
    }

    /**
     * Refresh the stats and save them to the database
     */
    public async refreshStats(): Promise<void> {
        const db = await getDb();
        try {
            const stats = await this.refresh();

            const myColl = db.collection(this.source);
            const result = await myColl.insertOne({
                timestamp: new Date(),
                metadata: {
                    source: this.source
                },
                stats
            });
            console.log(
                `Inserted measurement into ${this.source} collection with _id: ${result.insertedId} ${JSON.stringify(stats).slice(0, 100)}`
            );
        } catch (e:any) {
            console.error(`Error ${e} for source ${this.source} ${e?.stack.toString()}}`);
        }
    }

    /**
     * Setup the routes for this source
     * @param {any} app The express app
     */
    public setupRoutes(app: any) {
        app.get(`/login/${this.source}`, async (req: any, res: any) => {
            await this.loginFunction(req, res);
        });

        app.get(`/callback/${this.source}`, async (req: any, res: any) => {
            await this.callbackFunction(req, res);
        });
    }
}
