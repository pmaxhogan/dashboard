import {fetchApi} from "../lib/fetcher";
import React, {useEffect, useState} from "react";
import dynamic from "next/dynamic";
import {getFormatter, titleCase} from "../lib/chartUtils";

const ApexCharts = dynamic(() => import("react-apexcharts"), {ssr: false}) as any;

const monochrome = false;

export default function Source({source, subchartNames, isLoading, chartNameToSeries}: { source: string, isLoading: boolean, subchartNames: string[], chartNameToSeries: any }) {
    const charts = [];

    if(isLoading === false) {
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
                animations: {
                    enabled: true,
                    easing: "linear",
                    dynamicAnimation: {
                        speed: 1000
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
    }

    return <>
        {isLoading ? <div>{source}
            <progress style={{width: "100%"}}/>
        </div> : charts}
    </>;
}

