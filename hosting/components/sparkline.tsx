import {fetchApi} from "../lib/fetcher";
import React, {useEffect, useState} from "react";
import dynamic from "next/dynamic";
import {getFormatter, getFormatterManual, titleCase, toDecimal} from "../lib/chartUtils";

const ApexCharts = dynamic(() => import("react-apexcharts"), {ssr: false}) as any;

const monochrome = false;

export default function Sparkline({series, dataPath, friendlyName, isLoading}: {
    series: any[],
    dataPath: string,
    friendlyName: string,
    isLoading: boolean
}) {
    const charts = [];

    if (isLoading !== false) {
        return <div>Loading...</div>;
    }

    const options = {
        chart: {
            height: 350,
            foreColor: "#ccc", // heading colors
            dropShadow: {
                enabled: true,
                    top: 1,
                    left: 1,
                    blur: 2,
                    opacity: 0.2,
            },
            sparkline: {
                enabled: true
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
        stroke: {
            curve: "smooth"
        },
        colors: ['#fff'],
        yaxis: {
            show: false,
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
            show: false
        },

        animations: {
            enabled: true,
            easing: "linear",
            dynamicAnimation: {
                speed: 1000
            }
        },
        plotOptions: {
            bar: {
                borderRadius: 5,
            }
        },
        tooltip: {
            y: {
                show: false,
                formatter: val => val.toFixed(2)
            },
            x: {
                formatter: function (val) {
                    return "";//(new Date(val)).toLocaleTimeString()
                }
            }
        },
        grid: {
            padding: {
                top: 0,
                bottom: 0,
                left: 10
            }
        }
    };
    const seriesData = [{
        name: "",
        data: series[0].data
    }];

    const formatter = getFormatterManual([dataPath.split(".")[0], dataPath.split(".").slice(0, 2).join("."), dataPath]);

    const mostRecent = series[0].data[series[0].data.length - 1][1];
    return <>
        {isLoading ? <div>
            <progress style={{width: "100%"}}/>
        </div> : <div className="panel sparkline">
            <div>
                <div className={"count"}>
                    {formatter(mostRecent)}
                </div>
                <div className={"name"}>
                    {friendlyName}
                </div>
            </div>
            <ApexCharts options={options}
                             series={seriesData}
                             type="line" height={100}/>
        </div>}
    </>;
}

