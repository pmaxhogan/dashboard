import useSWR from "swr";
import {fetchApi, fetcher} from "../lib/fetcher";
import React from "react";
import SourceButton from "../components/sourcebutton";
import ChartGraph, {Chart} from "../components/ChartGraph";
import LoadingBar from "../components/LoadingBar";


export default function IndexPage() {
    const {data: sourcesData, error: sourcesError} = useSWR(`/sources`, fetcher);
    const {data: chartsData, error: chartsError} = useSWR(`/charts`, fetcher);
    if(sourcesError || chartsError) {
        return <div>failed to load</div>
    }
    if(!sourcesData || !chartsData) {
        return <LoadingBar className="main-loader"/>
    }

    const {charts} = chartsData as {charts: Chart[]}


    const sources = sourcesData?.sources ?? [];

    async function refresh() {
        await fetchApi(`/refresh`, {method: "POST"});
    }

    if (sourcesError || !sourcesData) return null;

    return (
        <>
            <button onClick={refresh}>Check for stats update</button>
            {sources.map((source) => (<SourceButton key={source} source={source}/>))}
            <br/>

            <div className="sparklines">
                {charts.filter(chart => chart.type === "sparkline").map(chart => <ChartGraph chart={chart} key={chart.title + ":" + chart.subTitle}/>)}
            </div>
            <div className="panels">
                {charts.filter(chart => chart.type !== "sparkline").map(chart => <ChartGraph chart={chart} key={chart.title + ":" + chart.subTitle}/>)}
            </div>
        </>
    )
}
