import {apiBase} from "../lib/fetcher";
import React, {useEffect, useState} from "react";
import dynamic from "next/dynamic";
const ApexCharts = dynamic(() => import('react-apexcharts'), { ssr: false }) as any;

const MINUTE_MS = 1000 * 10 * 10000;


export default function Source({source, aggregate} : {source: string, aggregate?: number}) {
    const [subchartNames, setSubchartNames] = useState([]);
    const [chartNameToSeries, setChartNameToSeries] = useState({});
    const [isLoading, setIsLoading] = useState(true);


    async function fetchData() {
        setIsLoading(true);
        const {
            series: subCharts,
            stats: datapoints
        } = await fetch(`${apiBase}/stats/${source}` + (aggregate ? `?aggregate=true&buckets=${aggregate}` : "")).then(response => response.json());
        const subchartNames = Object.keys(subCharts);
        setSubchartNames(subchartNames);
        setChartNameToSeries(subchartNames.reduce((acc, name) => {
            acc[name] = subCharts[name].map(series => ({
                name: titleCase(series),
                data: datapoints.map(point => [point.timestamp, point.stats[name][series]])
            }))
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
            markers: {
                // size: 3,
            },
            title: {
                text: `${titleCase(source)} Source: ${titleCase(subchartName)}`,
                align: "left"
            },
            stroke: {
                curve: "straight"
            },
            fill: {
                type: "gradient",
                gradient: {
                    shadeIntensity: 1,
                    inverseColors: false,
                    opacityFrom: 0.9,
                    opacityTo: 0,
                    stops: [0, 90, 100],
                },
            },
            yaxis: {
                labels: {
                    formatter: function (val) {
                        return val.toFixed(0);
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
                        return val.toFixed(0)
                    }
                },
                x: {
                    formatter: function (val) {
                        return (new Date(val)).toLocaleTimeString()
                    }
                }
            }
        };

        charts.push(<ApexCharts key={subchartName} options={options} series={chartNameToSeries[subchartName]} type="area" height={350} style={{margin: "10px"}} />);
    }

    return <>
        {isLoading ? <div>{source}
            <progress style={{width: "100%"}}/>
        </div> : charts}
    </>;
}

