import prodConfig from "../prodConfig.js";
import {StatSource} from "../StatSource.js";
import {debug, error, info, warn} from "firebase-functions/logger";
import oauthSuccess from "../oauthSuccess.js";
import {Source} from "../charts/chart.js";
import puppeteer, {ElementHandle} from "puppeteer";
import {DateTime} from "luxon";
import snowflakeToTime from "../snowlflakeToTime.js";
import cannedTweets from "../cannedTweets.js";
import createPasteBin from "../pasteHelper.js";


const runShell = async (command: string) => {
    const {exec} = await import("child_process");
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
        });
    });
};


const tryMakeInt = (str: string | null) => {
    if (str) {
        let factor = 1;
        if (str.endsWith("K")) {
            factor = 1000;
            str = str.slice(0, -1);
        } else if (str.endsWith("M")) {
            factor = 1000000;
            str = str.slice(0, -1);
        }

        const int = parseInt(str.replace(/,/g, "")) * factor;
        if (!isNaN(int)) {
            return int;
        }

        warn("could not parse int from", {
            location: "tscrsaper.tryMakeInt",
            str
        });
    }


    return null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sleepRandom = (min: number, max: number) => sleep(Math.floor(Math.random() * (max - min + 1)) + min);


prodConfig();

type TScraperStat = {
    [id: string]: number;
};

type TScraperStats = {
    replies: TScraperStat;
    retweets: TScraperStat;
    likes: TScraperStat;
    views: TScraperStat;
}


/**
 * Convert twitter ID to friendly date
 * @param {string} id the id
 * @return {string} date
 */
function idToDate(id: string) {
    const date = DateTime.fromJSDate(snowflakeToTime(id));
    const TIME_ZONE = "America/New_York"; // Replace with your desired time zone

    const convertedDate = date.setZone(TIME_ZONE);

    const hour = convertedDate.toFormat("h");
    const minute = convertedDate.toFormat("mm");
    const period = convertedDate.toFormat("a");
    const month = convertedDate.toFormat("M");
    const day = convertedDate.toFormat("d");

    return `${hour}:${minute}${period} ${month}/${day}`;
}

/**
 * Fetch tweets
 */
async function fetchTweets() {
    const debugBrowser = process.env.TSCRAPER_DEBUG_BROWSER === "true";
    const scrollIterations = parseInt(process.env.TSCRAPER_ITERATIONS || "1");
    const real = process.env.TSCRAPER_REAL === "true";

    debug("Fetching tweets", {
        location: "tscraper.fetchTweets",
        debugBrowser,
        scrollIterations,
        real
    });


    let tweetsMap: Map<string, any> = new Map<string, any>();
    if (real) {
        const browser = await puppeteer.launch(debugBrowser ? {
            headless: false,
            devtools: true,
        } : {
            headless: "new"
        });


        const page = await browser.newPage();

        await page.setViewport({width: 1920, height: 1080});

        const url = `https://twitter.com/${process.env.TSCRAPER_USERNAME}`;
        debug("tscraper going to page", {
            location: "tscraper.fetchTweets",
            debugBrowser,
            scrollIterations,
            real,
            url
        });

        try {
        // noinspection ES6MissingAwait
            page.goto(url);
            debug("tscraper went to page", {
                location: "tscraper.fetchTweets",
                debugBrowser,
                scrollIterations,
                real,
                url
            });

            await page.waitForSelector("[data-testid='primaryColumn']");
            await page.waitForSelector("[data-testid=\"tweet\"]");
            debug("tscraper loaded primary column", {
                location: "tscraper.fetchTweets",
                debugBrowser,
                scrollIterations,
                real,
                url
            });

            const checkForCloseButtons = async () => {
                const closeButtons = await page.$$("[data-testid=\"sheetDialog\"] span");
                if (closeButtons?.length) {
                    await sleepRandom(200, 600);
                    debug("tscraper closing dialog", {
                        location: "tscraper.fetchTweets",
                        debugBrowser,
                        scrollIterations,
                        real
                    });
                    await closeButtons[closeButtons.length - 1].click();
                    await sleepRandom(150, 250);
                }
            };


            tweetsMap = new Map<string, any>();


            for (let i = 0; i < scrollIterations; i++) {
                const tweetElems = await page.$$("[data-testid=\"tweet\"]");

                await checkForCloseButtons();

                debug("tscraper loaded iteration", {
                    location: "tscraper.fetchTweets",
                    debugBrowser,
                    scrollIterations,
                    real,
                    i,
                    tweetElems: tweetElems.length
                });

                await Promise.all(tweetElems.map(async (tweet) => {
                /**
                 * Count the number of replies, retweets, likes, or views next to the icon
                 * @param {ElementHandle} tweet
                 * @param {string} ariaLabel
                 * @return {Promise<number | null>}
                 */
                    async function countNextToIcon(tweet: ElementHandle, ariaLabel: string) {
                        const content = await tweet.$eval(`[aria-label$="${ariaLabel}"]`, (el) => el.textContent);

                        const result = tryMakeInt(content);

                        if (content && result == null) {
                            console.error(`Could not find ${ariaLabel} from content ${content}`, tweet);
                            error("Could not find aria label", {
                                location: "tscraper.fetchTweets",
                                debugBrowser,
                                scrollIterations,
                                real,
                                i,
                                tweetElems: tweetElems.length,
                                content,
                                ariaLabel
                            });
                        }

                        return result ?? 0;
                    }

                    if (tweet) {
                        const hasContext = await tweet.$("[data-testid=\"socialContext\"]");
                        if (hasContext) return null;

                        const id = await tweet.$eval("time", (el) => {
                            if (el?.parentElement) {
                                const href = el.parentElement.getAttribute("href");

                                if (href) {
                                    return href.split("/")[3];
                                }
                            }

                            return null;
                        });


                        if (id != null) {
                            let text;
                            try {
                                const fullText = await tweet.$eval("[data-testid=\"tweetText\"]", (el) => el?.textContent);

                                const friendlyDate = idToDate(id);

                                if (fullText && fullText.trim().length) {
                                    text = fullText.trim().slice(0, 14);
                                } else {
                                    text = friendlyDate;
                                }

                                const replies = await countNextToIcon(tweet, "Reply");
                                const retweets = await countNextToIcon(tweet, "Retweet");
                                const likes = await countNextToIcon(tweet, "Like");
                                const views = await countNextToIcon(tweet, "View Tweet analytics");

                                const resultObj = {replies, retweets, likes, views};

                                debug("tscraper text for tweet", {
                                    location: "tscraper.fetch.findId",
                                    text,
                                    friendlyDate,
                                    resultObj
                                });

                                tweetsMap.set(text, resultObj);
                            } catch (e) {
                                warn("Exception when processing tweet", {
                                    location: "tscraper.fetchTweets",
                                    debugBrowser,
                                    scrollIterations,
                                    real,
                                    i,
                                    tweetElems: tweetElems.length,
                                    id,
                                    text,
                                    e
                                });
                            }
                        } else {
                            error("Could not find id", {
                                location: "tscraper.fetchTweets",
                                debugBrowser,
                                scrollIterations,
                                real,
                                i,
                                tweetElems: tweetElems.length,
                                id
                            });
                        }
                    }

                    return null;
                }));

                await sleepRandom(250, 750);

                await checkForCloseButtons();

                if (i < scrollIterations - 1) {
                    await tweetElems[tweetElems.length - 1].scrollIntoView();
                }
            }


            if (!debugBrowser) {
                await browser.close();
            }
        } catch (e) {
            const fullHTML = await page.$eval("html", (el) => el?.outerHTML);

            const pasteUrl = await createPasteBin(fullHTML);
            error("Exception when processing page", {
                location: "tscraper.fetchTweets",
                debugBrowser,
                scrollIterations,
                real,
                e,
                pasteUrl
            });
            throw e;
        }
    } else {
        tweetsMap = new Map<string, never>(cannedTweets as unknown as [string, never][]);
    }

    return tweetsMap;
}

export default new StatSource(1000 * 60 * 60 - (1000 * 30), Source.TSCRAPER,
    async () => {
        const stats = {
            "replies": {} as TScraperStat,
            "retweets": {} as TScraperStat,
            "likes": {} as TScraperStat,
            "views": {} as TScraperStat
        } as TScraperStats;

        await runShell("npm run chrome");

        const tweets = await fetchTweets();

        debug("fetched tweets via scraper", {
            tweets: Object.fromEntries(tweets.entries())
        });

        if (tweets.size) {
            for (const [id, tweet] of tweets) {
                stats.replies[id] = tweet.replies;
                stats.retweets[id] = tweet.retweets;
                stats.likes[id] = tweet.likes;
                stats.views[id] = tweet.views;
            }

            debug("tscraper stats", {
                location: "tscraper.fetch",
                stats
            });


            return {
                stats
            };
        } else {
            info("failed to fetch tscraper", {
                location: "tscraper.fetch"
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

