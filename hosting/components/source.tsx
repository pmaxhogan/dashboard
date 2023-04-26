import {apiBase} from "../lib/fetcher";
import React, {useEffect, useState} from "react";
import dynamic from "next/dynamic";
const ApexCharts = dynamic(() => import('react-apexcharts'), { ssr: false }) as any;

const MINUTE_MS = 1000 * 10;


export default function Source({source}) {
    const [subchartNames, setSubchartNames] = useState([]);
    const [chartNameToSeries, setChartNameToSeries] = useState({});


    async function fetchData() {
        const {
            series: subCharts,
            stats: datapoints
        } = await fetch(`${apiBase}/api/stats/${source}`).then(response => response.json());
        const subchartNames = Object.keys(subCharts);
        setSubchartNames(subchartNames);
        console.log("subCharts", subCharts, datapoints);
        setChartNameToSeries(subchartNames.reduce((acc, name) => {
            acc[name] = subCharts[name].map(series => ({name: titleCase(series), data: datapoints.map(point => [point.timestamp, point.stats[name][series]])}))
            return acc;
        }, {}));
    }

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, MINUTE_MS);

        return () => clearInterval(interval); // This represents the unmount function, in which you need to clear your interval to prevent memory leaks.
    }, []);


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
            },
            tooltip: {
                shared: false,
                y: {
                    formatter: function (val) {
                        return val.toFixed(0)
                    }
                }
            }
        };

        charts.push(<ApexCharts key={subchartName} options={options} series={chartNameToSeries[subchartName]} type="area" height={350} style={{margin: "10px"}} />);
    }

    return <>
        {charts}
    </>;
}

