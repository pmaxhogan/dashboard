import {MongoClient, ServerApiVersion} from "mongodb";

const uri = process.env.MONGODB_URI as string;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
export const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
export const oauth = client.db("oauth");


export default client.db("homepage");
