import {fetchApi} from "../lib/fetcher";
import React, {useEffect, useState} from "react";
import dynamic from "next/dynamic";

const ApexCharts = dynamic(() => import('react-apexcharts'), {ssr: false}) as any;

const MINUTE_MS = 1000 * 10 * 10000;


export default function Source({source, aggregate}: { source: string, aggregate?: number }) {
    const [subchartNames, setSubchartNames] = useState([]);
    const [chartNameToSeries, setChartNameToSeries] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    async function fetchData() {
        setIsLoading(true);
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
        const interval = setInterval(fetchData, MINUTE_MS);

        return () => clearInterval(interval); // This represents the unmount function, in which you need to clear your interval to prevent memory leaks.
    }, [aggregate]);


    const titleCase = (str) => str.replaceAll("_", " ").replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());


    const charts = [];

    for (const subchartName of subchartNames) {
        const options = {
            chart: {
                type: "area",
                stacked: false,
                height: 350,
                foreColor: "#ccc", // heading colors
                zoom: {
                    type: "x",
                    enabled: true,
                    autoScaleYaxis: true
                },
                toolbar: {
                    autoSelected: "zoom"
                }
            },
            dataLabels: {
                enabled: false
            },
            title: {
                text: `${titleCase(source)}: ${titleCase(subchartName)}`,
                align: "left"
            },
            stroke: {
                curve: "straight"
            },
            yaxis: {
                labels: {
                    formatter: function (val) {
                        return val?.toFixed(0);
                    },
                },
                title: {
                    text: "Value"
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
            tooltip: {
                shared: false,
                y: {
                    formatter: function (val) {
                        return val?.toFixed(0)
                    }
                },
                x: {
                    formatter: function (val) {
                        return (new Date(val)).toLocaleTimeString()
                    }
                }
            }
        };
        let type;

        if (source === "STOCKS" && subchartName === "spy") {
            type = "candlestick";
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

