import {fetchApi} from "../lib/fetcher";
import React, {useEffect, useState} from "react";
import dynamic from "next/dynamic";
import {Duration} from "luxon";

const ApexCharts = dynamic(() => import("react-apexcharts"), {ssr: false}) as any;

const refreshInterval = 1000 * 7;


function formatDurationMinutes(minutes) {
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

const formatDurationSeconds = (seconds) => formatDurationMinutes(seconds / 60);


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

const getFormatter = (source, subchartName, chartNameToSeries) => (val, obj) => {
    const {seriesIndex} = obj || {};
    const searchStrings = [source.toLowerCase(), `${source.toLowerCase()}.${subchartName}`];

    if (seriesIndex) {
        const seriesName = chartNameToSeries[subchartName][seriesIndex].name;
        searchStrings.push(`${source.toLowerCase()}.${subchartName}.${seriesName}`.toLowerCase());
    }

    for (const {sources, format} of sourceToFormat) {
        if (sources.some(source => searchStrings.includes(source))) {
            return format(val);
        }
    }

    return val?.toFixed(0);
};

const monochrome = false;

export default function Source({source, aggregate}: { source: string, aggregate?: number }) {
    const [subchartNames, setSubchartNames] = useState([]);
    const [chartNameToSeries, setChartNameToSeries] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    async function fetchData() {
        const {
            series: subCharts,
            stats: datapoints
        } = await fetchApi(`/stats/${source}` + (aggregate ? `?aggregate=true&buckets=${aggregate}` : "")).then(response => response.json());
        const subchartNames = Object.keys(subCharts);
        setSubchartNames(subchartNames);
        setChartNameToSeries(subchartNames.reduce((acc, name, idx) => {
            if (source === "STOCKS" && name === "spy") {
                acc[name] = [{
                    name: "SPY",
                    data: datapoints.map(point => {
                        return {
                            x: (new Date(point.timestamp)),
                            y: [point.stats[name].open, point.stats[name].high, point.stats[name].low, point.stats[name].close]
                        };
                    })
                }];
            } else {
                acc[name] = subCharts[name].map(series => {
                    return ({
                        name: titleCase(series),
                        data: datapoints.map(point => {
                            return [point.timestamp, point.stats[name][series] ?? 0];
                        })
                    });
                })
            }
            return acc;
        }, {}));
        setIsLoading(false);
    }

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, refreshInterval);

        return () => clearInterval(interval); // This represents the unmount function, in which you need to clear your interval to prevent memory leaks.
    }, [aggregate]);


    const titleCase = (str) => str.replaceAll("_", " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());


    const charts = [];

    for (const subchartName of subchartNames) {
        const isStackedBar = source === "FITBIT" && subchartName === "sleep";

        const options = {
            chart: {
                stacked: isStackedBar,
                height: 350,
                foreColor: "#ccc", // heading colors
                zoom: {
                    type: "x",
                    enabled: true,
                    autoScaleYaxis: true
                },
                toolbar: {
                    autoSelected: "zoom"
                },
                background: "#FFFFFF00"
            },
            theme: {
                mode: 'dark',
                palette: 'palette10',
                monochrome: {
                    enabled: monochrome,
                    color: '#77006f',
                    shadeIntensity: 1
                }
            },
            dataLabels: {
                enabled: false
            },
            title: {
                text: `${titleCase(source)}`,
                align: "left",
                style: {
                    fontSize: "23px",
                    fontWeight: "bold",
                    fontFamily: "Roboto",
                }
            },
            subtitle: {
                text: `${subchartName.slice(0, 1).toUpperCase()}${subchartName.slice(1).replaceAll("_", " ")}`,
                align: "left",
                style: {
                    fontSize: "17px",
                    fontWeight: "bold",
                    fontFamily: "Roboto",
                    color: "rgba(204,204,204,0.55)"
                }
            },
            stroke: {
                curve: "smooth"
            },
            yaxis: {
                labels: {
                    formatter: getFormatter(source, subchartName, chartNameToSeries),
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
                }
                // tickAmount: 6
            },
            plotOptions: {
                bar: {
                    borderRadius: 5,
                }
            },
            tooltip: {
                shared: false,
                y: {
                    formatter: getFormatter(source, subchartName, chartNameToSeries)
                },
                x: {
                    formatter: function (val) {
                        return (new Date(val)).toLocaleTimeString()
                    }
                }
            },
            grid: {
                show: true,
                borderColor: "rgba(166,166,166,0.62)",
                strokeDashArray: 4,
            }
        };
        let type;

        if (source === "STOCKS" && subchartName === "spy") {
            type = "candlestick";
        } else if (isStackedBar) {
            type = "bar";
        } else {
            type = "area";
        }

        charts.push(<ApexCharts className="panel" key={subchartName} options={options}
                                series={chartNameToSeries[subchartName]}
                                type={type} height={350}/>);
    }

    return <>
        {isLoading ? <div>{source}
            <progress style={{width: "100%"}}/>
        </div> : charts}
    </>;
}

