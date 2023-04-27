import {Db, MongoClient, ServerApiVersion} from "mongodb";


let _db:Db|null = null;
let _client:MongoClient|null = null;

export const getClient = async () => {
    const uri = process.env.MONGODB_URI as string;
    if (_client) return _client;
    _client = new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });
    await _client.connect();
    return _client;
};

export const getDb = async () => {
    if (_db) return _db;
    _db = (await getClient()).db("homepage");
    return _db;
};

export const getOauthDb = async () => {
    return (await getClient()).db("oauth");
};
