import prodConfig from "../prodConfig.js";
import {Source, StatSource} from "../StatSource.js";
import {debug} from "firebase-functions/logger";
import oauthSuccess from "../oauthSuccess.js";

prodConfig();

type TestStats = {
    hours: number;
    minutes: number;
    seconds: number;
}

export default new StatSource(1000 * 5, Source.TIME, async () => {
    const stats: TestStats = {
        hours: (new Date()).getHours(),
        minutes: (new Date()).getMinutes(),
        seconds: (new Date()).getSeconds()
    };

    debug("timeSource", {
        location: "timeSource",
        stats
    });

    return {
        stats: {
            "clock": stats,
        }
    };
}, async (req, res) => {
    return oauthSuccess(req, res);
}, async (req, res) => {
    return oauthSuccess(req, res);
});
