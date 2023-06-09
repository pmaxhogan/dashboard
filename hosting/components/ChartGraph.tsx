import {formatDurationMinutes, getFormatter, titleCase} from "../lib/chartUtils";
import React, {useEffect} from "react";
import useSWR from "swr";
import {fetcher} from "../lib/fetcher";
import dynamic from "next/dynamic";
import LoadingBar from "./LoadingBar";
const ApexChartsComponent = dynamic(() => import("react-apexcharts"), {ssr: false}) as any;

const monochrome = false;

export type ChartType = "area" | "bar" | "candlestick" | "sparkline" | "scatter" | "line";
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
    TSCRAPER_RELATIVE = "tscraper_relative",
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
    relativeTime?: boolean;
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

export default function ChartGraph({chart}: { chart: Chart, refreshKey: number }) {
    const isSparkline = chart.type === "sparkline";
    const aggregate = isSparkline ? 100 : 300;
    let queryStr = chart.since ? `sinceTime=${chart.since.value}&sinceUnits=${chart.since.units}` : "";
    if(chart.delta) queryStr += "&delta=true";

    const {data, error} = useSWR(`/stats/${chart.source.toUpperCase()}?${queryStr}&aggregate=true&buckets=${aggregate}&relativeTime=${chart.relativeTime}`, fetcher);

    const chartId = `chart-${Math.random().toString(36).slice(2)}`;


    const isDynamicSeries = !chart.series[0];
    function getSeries(){
        if(!isDynamicSeries){
            return chart.series as Series[];
        }
        else if(data && data.stats.length){
            const subSourceIds = data.series[chart.subSource];

            if(!subSourceIds){
                console.log("CAPTURE", chart, data);
            }

            const singleSeries = chart.series as Series;

            return subSourceIds.map(source => ({
                ...singleSeries, name: source,
                id: source
            })) as Series[];
        }  else{
            return [];
        }
    }

    useEffect(() => {
        if(typeof window !== "undefined" && data && !error) {
            const seriesList = getSeries();
            for (const series of seriesList) {
                if (!series.defaultVisible && series.name) {
                    const process = () => {
                        try {
                            // @ts-ignore
                            window.ApexCharts.exec(chartId, "hideSeries", [series.name]);
                        } catch (e) {
                            window.requestAnimationFrame(process);
                        }
                    };
                    process();
                }
            }
        }
    });

    if (!data || error) {
        return <div className={"panel" + (isSparkline ? " sparkline" : "")}>
            {isSparkline && <div className="sidebar-left-side">
                <div className={"count"}>
                    ??
                </div>
                <div className={"name"}>
                    {chart.title}
                </div>
                <div className={"subtitle"}>
                    ({chart.since.value}{chart.since.units[0]})
                </div>
            </div>}
        <LoadingBar/>
    </div>;
    }

    const {
        series: subCharts,
        stats: datapoints
    } = data;


    const series = getSeries().map((series, idx) => {
        return {
            name: series.name ?? (getSeries().length > 1 ? series.id ?? "" : ""),
            data: datapoints.map((point, idx, allPoints) => {
                const x = chart.relativeTime ? point.timestamp : new Date(point.timestamp);

                if(chart.type === "candlestick") {
                    if(series.removeNullsAndZeroes && (point.stats[chart.subSource].open ?? 0) === 0) return null;
                    return {
                        x,
                        y: [point.stats[chart.subSource].open, point.stats[chart.subSource].high, point.stats[chart.subSource].low, point.stats[chart.subSource].close]
                    };
                }
                let dataPoint = (point?.stats && point?.stats[chart.subSource]&& point?.stats[chart.subSource][series.id]);

                dataPoint = dataPoint ?? (chart.relativeTime ? null : 0);

                if(!dataPoint && dataPoint !== 0 && chart.relativeTime){
                    // attempt to interpolate
                    let startX;
                    let startY;
                    for(startX = idx - 1; startX >= 0; startX --) {
                        if(allPoints[startX]?.stats && allPoints[startX]?.stats[chart.subSource] && allPoints[startX]?.stats[chart.subSource][series.id]){
                            startY = allPoints[startX]?.stats[chart.subSource][series.id];
                            break;
                        }
                    }

                    let endX;
                    let endY;
                    for(endX = idx + 1; endX < allPoints.length; endX ++){
                        if(allPoints[endX]?.stats && allPoints[endX]?.stats[chart.subSource] && allPoints[endX]?.stats[chart.subSource][series.id]){
                            endY = allPoints[endX]?.stats[chart.subSource][series.id];
                            break;
                        }
                    }

                    if(startX !== undefined && startY !== undefined && endX !== undefined && endY !== undefined){
                        const slope = (endY - startY) / (endX - startX);
                        const yIntercept = startY - (slope * startX);
                        dataPoint = (slope * idx) + yIntercept;
                    }
                }

                if(series.removeNullsAndZeroes && dataPoint === 0) return null;
                return [x, dataPoint];
            }).filter(Boolean).filter((data, idx, arr) => {
                if(chart.type !== "candlestick") return true;
                if(arr.findIndex((item) => (
                    chart.relativeTime ? item.x === data.x : (
                    new Date(item.x)).toLocaleDateString() === (new Date(data.x)).toLocaleDateString())
                ) === idx
                ) return true;
            })
        }
    });

    const options = {
        chart: {
            stacked: chart.stacked ?? false,
            width: 500,
            height: 350,
            foreColor: "#ccc", // heading colors
            dropShadow: isSparkline ? {
                enabled: true,
                top: 1,
                left: 1,
                blur: 2,
                opacity: 0.2,
            } : false,
            sparkline: isSparkline && { enabled: true },
            zoom: !isSparkline && {
                type: "x",
                enabled: true,
                autoScaleYaxis: true
            },
            toolbar: !isSparkline && {
                autoSelected: "zoom"
            },
            background: "#FFFFFF00",
            id: chartId,
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
        colors: isSparkline ? ["#fff"] : undefined,
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
            min: chart.startYAxisAtZero ? 0 : undefined,
        },
        xaxis: chart.relativeTime ? {
            show: !isSparkline
        } : {
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
        title: isSparkline ? {} : {
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
        subtitle: {
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
                    return chart.relativeTime ? formatDurationMinutes(val) : (new Date(val)).toLocaleString()
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

    const mostRecentData = series[0]?.data[series[0].data.length - 1];
    if(!mostRecentData) return null;
    const mostRecent = mostRecentData[1];

    getSeries();

    return <div className={"panel" + (isSparkline ? " sparkline" : "")}>
        {isSparkline && <div>
            <div className={"count"}>
                {getFormatter(chart.format)(mostRecent)}
            </div>
            <div className={"name"}>
                {chart.title}
            </div>
            <div className={"subtitle"}>
                ({chart.since.value}{chart.since.units[0]})
            </div>
        </div>}
        <ApexChartsComponent options={options}
                             series={series}
                             type={isSparkline ? "line" : chart.type} height={isSparkline ? 100 : 350} id={chartId}/>
    </div>;
};
