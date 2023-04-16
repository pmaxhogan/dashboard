// Replace the placeholder with your Atlas connection string
import {MongoClient, ServerApiVersion} from "mongodb";

const uri = "mongodb://localhost:27017";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


export default client.db("homepage");
