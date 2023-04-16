import {StatSource} from "../StatSource";

type TestStats = {
    hours: number;
    minutes: number;
    seconds: number;
}

export default new StatSource(1000, "time", async () => {
    const stats:TestStats = {
        hours: (new Date()).getHours(),
        minutes: (new Date()).getMinutes(),
        seconds: (new Date()).getSeconds()
    };

    return {
        stats
    };
});
