import {Chart, Source} from "./chart.js";
import {trello} from "./trelloChartDefinitions.js";

const sparklines:Chart[] = [
    {
        title: "Followers",
        type: "sparkline",
        source: Source.TWITTER,
        subSource: "profile",
        series: [{id: "followers"}],
        since: {
            value: 1,
            units: "weeks"
        }
    },
    {
        title: "Unread Emails",
        type: "sparkline",
        source: Source.GMAIL,
        subSource: "inbox",
        series: [{id: "num_unread"}],
        since: {
            value: 3,
            units: "days"
        }
    },
    {
        title: "°F",
        type: "sparkline",
        source: Source.WEATHER,
        subSource: "temp",
        series: [{id: "temp"}],
        since: {
            value: 1,
            units: "days"
        }
    },
    {
        title: "mph wind",
        type: "sparkline",
        source: Source.WEATHER,
        subSource: "wind",
        series: [{id: "speed"}],
        since: {
            value: 1,
            units: "days"
        }
    },
    {
        title: "School",
        type: "sparkline",
        source: Source.TRELLO,
        subSource: "total_time_in_label",
        series: [{id: "School"}],
        since: {
            value: 3,
            units: "days"
        },
        format: "durationMinutes"
    },
    {
        title: "Ready",
        type: "sparkline",
        source: Source.TRELLO,
        subSource: "total_time_in_list",
        series: [{id: "Ready"}],
        since: {
            value: 3,
            units: "days"
        },
        format: "durationMinutes"
    },
    {
        title: "In Progress",
        type: "sparkline",
        source: Source.TRELLO,
        subSource: "total_time_in_list",
        series: [{id: "In Progress"}],
        since: {
            value: 3,
            units: "days"
        },
        format: "durationMinutes"
    },
    {
        title: "mi on bike",
        type: "sparkline",
        source: Source.STRAVA,
        subSource: "allTime",
        series: [{id: "distance"}],
        since: {
            value: 1,
            units: "weeks"
        }
    }
];
const twitter:Chart[] = [
    {
        title: "Twitter",
        subTitle: "Profile",
        type: "area",
        source: Source.TWITTER,
        subSource: "profile",
        series: [
            {
                name: "Followers",
                defaultVisible: true,
                id: "followers"
            },
            {
                name: "Following",
                id: "following"
            },
            {
                name: "Tweets",
                id: "tweets"
            },
            {
                name: "Lists",
                id: "lists"
            }
        ],
        since: {
            value: 3,
            units: "weeks"
        }
    },
    {
        title: "Twitter Deltas",
        subTitle: "Profile",
        type: "area",
        source: Source.TWITTER,
        subSource: "profile",
        delta: true,
        series: [
            {
                name: "Followers",
                defaultVisible: true,
                id: "followers"
            },
            {
                name: "Following",
                id: "following"
            },
            {
                name: "Tweets",
                id: "tweets"
            },
            {
                name: "Lists",
                id: "lists"
            }
        ],
        since: {
            value: 3,
            units: "weeks"
        }
    },
];
const tscraper:Chart[] = ["Replies", "Retweets", "Likes", "Views"].map((type) => {
    return {
        title: "Tscraper",
        subTitle: type,
        type: "area",
        source: Source.TSCRAPER,
        subSource: type.toLowerCase(),
        series: {
            name: type,
            defaultVisible: true,
            id: type.toLowerCase()
        },
        since: {
            value: 3,
            units: "weeks"
        }
    };
});

const gmail:Chart[] = [
    {
        title: "Gmail",
        subTitle: "Inbox Unread",
        type: "area",
        source: Source.GMAIL,
        subSource: "inbox",
        series: [
            {
                name: "Num Unread",
                defaultVisible: true,
                id: "num_unread"
            }
        ],
        since: {
            value: 2,
            units: "weeks"
        }
    },
    {
        title: "Drive",
        subTitle: "Usage (MB)",
        type: "area",
        source: Source.GMAIL,
        subSource: "drive",
        series: [
            {
                name: "Usage",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "usage"
            },
            {
                name: "Usage, Drive",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "driveUsage"
            },
            {
                name: "Limit",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "limit"
            },
        ],
        startYAxisAtZero: true
    }
];
const fitbit:Chart[] = [
    {
        title: "Fitbit",
        subTitle: "Hours of Sleep",
        type: "bar",
        source: Source.FITBIT,
        subSource: "sleep",
        stacked: true,
        format: "durationMinutes",
        since: {
            value: 1,
            units: "months"
        },
        series: [
            {
                name: "Deep",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "deep"
            },
            {
                name: "Light",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "light"
            },
            {
                name: "REM",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "rem"
            },
            {
                name: "Awake",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "wake"
            },
        ]
    },
    {
        title: "Fitbit",
        subTitle: "Active Minutes",
        type: "area",
        source: Source.FITBIT,
        subSource: "activeMinutes",
        series: [
            {
                name: "Peak",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "cardio"
            },
            {
                name: "Cardio",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "cardio"
            },
            {
                name: "Fat Burn",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "fatBurn"
            },
        ]
    },
    {
        title: "Fitbit",
        subTitle: "Resting HR",
        type: "area",
        source: Source.FITBIT,
        subSource: "rhr",
        series: [
            {
                name: "BPM",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "rhrValue"
            }
        ]
    },
    {
        title: "Fitbit",
        subTitle: "Calories",
        type: "area",
        source: Source.FITBIT,
        subSource: "calories",
        series: [
            {
                name: "Calories",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "caloriesValue"
            }
        ]
    },
    {
        title: "Fitbit",
        subTitle: "Sleep Breathing Rate",
        type: "area",
        source: Source.FITBIT,
        subSource: "sleepBreathing",
        series: [
            {
                name: "Deep",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "deep"
            },
            {
                name: "Light",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "light"
            },
            {
                name: "REM",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "rem"
            },
        ]
    },
    {
        title: "Fitbit",
        subTitle: "Vo2Max",
        type: "area",
        source: Source.FITBIT,
        subSource: "vo2Max",
        series: [
            {
                name: "Vo2Max",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "vo2MaxValue"
            }
        ]
    },
    {
        title: "Fitbit",
        subTitle: "Heart Rate Variability",
        type: "area",
        source: Source.FITBIT,
        subSource: "hrvValues",
        series: [
            {
                name: "Daily (RMSSD)",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "dailyRmssd"
            },
            {
                name: "Deep (RMSSD)",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "deepRmssd"
            }
        ]
    },
    {
        title: "Fitbit",
        subTitle: "Skin Temperature (Relative)",
        type: "area",
        source: Source.FITBIT,
        subSource: "skinTemp",
        series: [
            {
                name: "Skin Temperature",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "skinTempValue"
            }
        ]
    },
];
const stocks:Chart[] = [
    {
        title: "Stocks",
        subTitle: "$SPY",
        type: "candlestick",
        source: Source.STOCKS,
        subSource: "spy",
        series: [
            {
                name: "spy",
                defaultVisible: true,
                id: "spy"
            }
        ]
    }
];
const strava:Chart[] = [
    {
        title: "Strava",
        subTitle: "Ride Speed",
        type: "area",
        source: Source.STRAVA,
        subSource: "rides",
        series: [
            {
                name: "Average Speed",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "average_speed"
            },
            {
                name: "Max Speed",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "max_speed"
            },
        ]
    },
    {
        title: "Strava",
        subTitle: "Ride Distance",
        type: "area",
        source: Source.STRAVA,
        subSource: "rides",
        series: [
            {
                name: "Distance",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "distance"
            },
            {
                name: "Average Speed",
                removeNullsAndZeroes: true,
                id: "average_speed"
            },
            {
                name: "Max Speed",
                removeNullsAndZeroes: true,
                id: "max_speed"
            },
            {
                name: "Average Watts",
                removeNullsAndZeroes: true,
                id: "average_watts"
            },
            {
                name: "Elevation Gain",
                removeNullsAndZeroes: true,
                id: "total_elevation_gain"
            },
            {
                name: "Achievement Count",
                removeNullsAndZeroes: true,
                id: "achievement_count"
            },
        ]
    },
    {
        title: "Strava",
        subTitle: "Biggest",
        type: "area",
        source: Source.STRAVA,
        subSource: "biggest",
        series: [
            {
                name: "Distance",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "distance"
            },
            {
                name: "Climb",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "climb"
            },
        ]
    },
    {
        title: "Strava",
        subTitle: "YTD",
        type: "area",
        source: Source.STRAVA,
        subSource: "ytd",
        series: [
            {
                name: "Distance",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "distance"
            },
            {
                name: "Time",
                removeNullsAndZeroes: true,
                id: "time"
            },
            {
                name: "Elevation",
                removeNullsAndZeroes: true,
                id: "elevation"
            },
            {
                name: "Count",
                removeNullsAndZeroes: true,
                id: "count"
            },
        ]
    },
    {
        title: "Strava",
        subTitle: "All Time",
        type: "area",
        source: Source.STRAVA,
        subSource: "allTime",
        series: [
            {
                name: "Distance",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "distance"
            },
            {
                name: "Time",
                removeNullsAndZeroes: true,
                id: "time"
            },
            {
                name: "Elevation",
                removeNullsAndZeroes: true,
                id: "elevation"
            },
            {
                name: "Count",
                removeNullsAndZeroes: true,
                id: "count"
            },
        ]
    },
];
const weather:Chart[] = [
    {
        title: "Weather",
        subTitle: "Temperature",
        type: "area",
        source: Source.WEATHER,
        subSource: "temp",
        series: [
            {
                name: "Temperature",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "temp"
            },
            {
                name: "Feels Like",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "feels_like"
            }
        ],
        since: {
            value: 1,
            units: "weeks"
        }
    },
    {
        title: "Weather",
        subTitle: "Wind",
        type: "area",
        source: Source.WEATHER,
        subSource: "wind",
        series: [
            {
                name: "Speed",
                defaultVisible: true,
                removeNullsAndZeroes: true,
                id: "speed"
            },
            {
                name: "Gust",
                removeNullsAndZeroes: true,
                defaultVisible: true,
                id: "gust"
            },
            {
                name: "Heading",
                removeNullsAndZeroes: true,
                defaultVisible: false,
                id: "deg"
            }
        ],
        since: {
            value: 1,
            units: "weeks"
        }
    },
];


export const charts: Chart[] = [
    ...sparklines,
    ...twitter,
    ...gmail,
    ...trello,
    ...stocks,
    ...fitbit,
    ...strava,
    ...weather,
    ...tscraper,
];
