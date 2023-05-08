import {Duration} from "luxon";

export const titleCase = (str) => str.replaceAll("_", " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
export function formatDurationMinutes(minutes) {
    const duration = Duration.fromObject({ minutes });
    const days = Math.floor(duration.as("days"));
    const hours = Math.floor(duration.minus({ days }).as("hours"));
    const minutesRemainder = Math.floor(duration.minus({ days, hours }).as("minutes"));

    let str = "";
    if (days > 0) str += `${days}d `;
    if(hours > 0) str += `${hours}h `;
    if (minutesRemainder > 0 || !str.length) str += `${minutesRemainder}m `;

    return str.trim();
}

export const formatDurationSeconds = (seconds) => formatDurationMinutes(seconds / 60);


const sourceToFormat: { sources: string[]; format: (value) => string }[] = [
    {
        sources: ["trello.total_time_in_label", "trello.total_time_in_list", "fitbit.sleep", "fitbit.activeminutes"],
        format: formatDurationMinutes
    },
    {
        sources: ["strava.ytd.time", "strava.alltime.time"],
        format: formatDurationSeconds
    }
];

export const getFormatter = (source, subchartName, chartNameToSeries) => (val, obj) => {
    const {seriesIndex} = obj || {};
    const searchStrings = [source.toLowerCase(), `${source.toLowerCase()}.${subchartName}`];

    if (seriesIndex) {
        const seriesName = chartNameToSeries[subchartName][seriesIndex].name;
        searchStrings.push(`${source.toLowerCase()}.${subchartName}.${seriesName}`.toLowerCase());
    }

    return getFormatterManual(searchStrings)(val);
};

export const getFormatterManual = (searchStrings) => (val) => {
    for (const {sources, format} of sourceToFormat) {
        if (sources.some(source => searchStrings.includes(source))) {
            return format(val);
        }
    }

    return val && toDecimal(val, 0);
};

export const toDecimal = (num, places = 2) => parseFloat(num.toFixed(places));