import prodConfig from "../prodConfig.js";
prodConfig();

import {Source, StatSource} from "../StatSource.js";
import {debug} from "firebase-functions/logger";

type TestStats = {
    hours: number;
    minutes: number;
    seconds: number;
}

export default new StatSource(1000 * 60 * 5, Source.TIME, async () => {
    const stats:TestStats = {
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
    res.status(204).end();
}, async (req, res) => {
    res.status(204).end();
});
