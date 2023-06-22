
export type ChartType = "area" | "bar" | "candlestick" | "sparkline";
export type TimeUnits = "" | "minutes" | "hours" | "days" | "weeks" | "months" | "years";
export type Format = "durationSeconds" | "durationMinutes";

export enum Source {
    TWITTER = "twitter",
    TRELLO = "trello",
    GMAIL = "gmail",
    FITBIT = "fitbit",
    STOCKS = "stocks",
    STRAVA = "strava",
    WEATHER = "weather",
    TSCRAPER = "tscraper",
}

export type Chart = {
    title: string;
    subTitle?: string;
    type: ChartType;
    stacked?: boolean;
    source: Source;
    subSource: string;
    series: Series | Series[];
    since?: Since;
    format?: Format;
    startYAxisAtZero?: boolean;
    delta?: boolean;
};

export type Series = {
    removeNullsAndZeroes?: boolean;
    name?: string;
    defaultVisible?: boolean
    id: string;
}

export type Since = {
    value: number;
    units: TimeUnits;
}
