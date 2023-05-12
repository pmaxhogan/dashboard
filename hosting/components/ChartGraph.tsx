import {getFormatter, titleCase} from "../lib/chartUtils";
import React from "react";
import useSWR from "swr";
import {fetcher} from "../lib/fetcher";
import dynamic from "next/dynamic";
const ApexCharts = dynamic(() => import("react-apexcharts"), {ssr: false}) as any;

const monochrome = false;
const aggregate = 300;

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
}

export type Chart = {
    title: string;
    subTitle?: string;
    type: ChartType;
    stacked?: boolean;
    source: Source;
    subSource: string;
    series: Series[];
    since?: Since;
    format?: Format;
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


const removeEmpty = (obj) => {
    let newObj = {};
    Object.keys(obj).forEach((key) => {
        if (obj[key] === Object(obj[key])) newObj[key] = removeEmpty(obj[key]);
        else if (obj[key] !== undefined) newObj[key] = obj[key];
    });
    return newObj;
};

export default function ChartGraph({chart}: { chart: Chart }) {
    const isSparkline = chart.type === "sparkline";
    const queryStr = chart.since ? `sinceTime=${chart.since.value}&sinceUnits=${chart.since.units}` : "";

    const {data, error} = useSWR(`/stats/${chart.source.toUpperCase()}?${queryStr}&aggregate=true&buckets=${aggregate}`, fetcher);


    if (!data || error) {
        return <div>Loading...</div>;
    }

    const {
        series: subCharts,
        stats: datapoints
    } = data;

    console.log(subCharts, datapoints);

    const series = chart.series.map((series, idx) => {
        return {
            name: series.name ?? "",
            data: datapoints.map(point => {
                if(chart.type === "candlestick") {
                    return {
                        x: (new Date(point.timestamp)),
                        y: [point.stats[chart.subSource].open, point.stats[chart.subSource].high, point.stats[chart.subSource].low, point.stats[chart.subSource].close]
                    };
                }
                return [point.timestamp, point.stats[chart.subSource][series.id] ?? 0];
            })
        }
    });




/*
        if (chart.source === Source.STOCKS && chart.subSource === "spy") {
            return {
                name: "SPY",
                data: datapoints.map(point => {
                    return {
                        x: (new Date(point.timestamp)),
                        y: [point.stats[name].open, point.stats[name].high, point.stats[name].low, point.stats[name].close]
                    };
                })
            };
        } else {
            return subCharts[name].map(series => {
                return ({
                    name: titleCase(series),
                    data: datapoints.map(point => {
                        return [point.timestamp, point.stats[name][series] ?? 0];
                    })
                });
            })
        }
    }, {});


*/





    let options = {
        chart: {
            stacked: chart.stacked ?? false,
            height: 350,
            foreColor: "#ccc", // heading colors
            dropShadow: isSparkline && {
                enabled: true,
                top: 1,
                left: 1,
                blur: 2,
                opacity: 0.2,
            },
            sparkline: isSparkline && { enabled: true },
            zoom: !isSparkline && {
                type: "x",
                enabled: true,
                autoScaleYaxis: true
            },
            toolbar: !isSparkline && {
                autoSelected: "zoom"
            },
            background: "#FFFFFF00"
        },
        theme: {
            mode: "dark",
            palette: 'palette10',
            monochrome: {
                enabled: monochrome,
                color: '#77006f',
                shadeIntensity: 1
            }
        },
        stroke: {
            curve: "smooth"
        },
        colors: isSparkline && ["#fff"],
        yaxis: isSparkline ? {show:false} : {
            labels: {
                formatter: getFormatter(chart.format),
                style: {
                    fontSize: "14px",
                    fontFamily: "Roboto",
                    colors: ["rgba(204,204,204,0.53)"]
                },
                minWidth: 40,
            },
        },
        xaxis: {
            type: "datetime",
            labels: {
                /*formatter: function (value, timestamp) {
                    return (new Date(timestamp)).toLocaleTimeString() // The formatter function overrides format property
                },*/
                format: "MM/dd"
            },
            // tickAmount: 6
            show: !isSparkline
        },
        dataLabels: {
            enabled: false
        },
        title: !isSparkline && {
            text: chart.title,
            align: "left",
            style: {
                fontSize: "23px",
                fontWeight: "bold",
                fontFamily: "Roboto",
            }
        },
        animations: {
            enabled: true,
            easing: "linear",
            dynamicAnimation: {
                speed: 1000
            }
        },
        subtitle: chart.subTitle && {
            text: chart.subTitle,
            align: "left",
            style: {
                fontSize: "17px",
                fontWeight: "bold",
                fontFamily: "Roboto",
                color: "rgba(204,204,204,0.55)"
            }
        },

        plotOptions: {
            bar: {
                borderRadius: 5,
            }
        },
        tooltip: {
            shared: false,
            y: {
                show: !isSparkline,
                formatter: getFormatter(chart.format)
            },
            x: {
                formatter: function (val) {
                    return (new Date(val)).toLocaleTimeString()
                }
            }
        },
        grid: isSparkline ? {
            padding: {
                top: 0,
                bottom: 0,
                left: 10
            }
        }: {
            show: true,
            borderColor: "rgba(166,166,166,0.62)",
            strokeDashArray: 4,
        }
    };

    options = removeEmpty(options) as any;

    console.log("series", options, series);

    return <ApexCharts className="panel" options={options}
                       series={series}
                       type={chart.type} height={350}/>;
};
