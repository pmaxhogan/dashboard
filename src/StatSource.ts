import db from "./db";

// @ts-ignore
const deleteAll = async (colName: string) => {
    const collection = db.collection(colName);
    const result = await collection.deleteMany({});
    console.log(`Deleted ${result.deletedCount} documents`);
};


export type source = "twitter" | "time";

type RefreshFunction = () => Promise<RefreshData>;

interface RefreshData {
    stats: {
        [key: string]: number;
    }
}

/**
 * A class that represents a source of stats
 */
export class StatSource {
    /**
     * Create a new StatSource
     * @param refreshFrequency
     * @param source
     * @param refresh
     */
    constructor(public refreshFrequency: number, public source: source, public refresh: RefreshFunction,
                public loginFunction: (req: any, res: any) => Promise<any>,
                public callbackFunction: (req: any, res: any) => Promise<any>,
    ) {
        this.refreshFrequency = refreshFrequency;
        this.source = source;
        this.refresh = refresh;
        this.loginFunction = loginFunction;
        // deleteAll(this.source);
    }

    /**
     * Refresh the stats and save them to the database
     */
    public async refreshStats(): Promise<void> {
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
            `A document was inserted with the _id: ${result.insertedId}`,
        );
    }
}