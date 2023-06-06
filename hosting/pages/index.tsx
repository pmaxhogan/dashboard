import useSWR from "swr";
import {fetchApi, fetcher} from "../lib/fetcher";
import React, {KeyboardEvent, KeyboardEventHandler, useEffect} from "react";
import SourceButton from "../components/sourcebutton";
import ChartGraph, {Chart} from "../components/ChartGraph";
import LoadingBar from "../components/LoadingBar";


export default function IndexPage() {
    const {data: sourcesData, error: sourcesError} = useSWR(`/sources`, fetcher);
    const {data: chartsData, error: chartsError} = useSWR(`/charts`, fetcher);
    const [refreshKey, setRefreshKey] = React.useState(0);
    const [showButtons, setShowButtons] = React.useState(false);

    const refresh = () => {
        console.log("refreshing");
        setRefreshKey(refreshKey + 1);
    };


    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if(e.key === "r") {
                refresh();
            } else if(e.key === "b") {
                console.log("toggle buttons", showButtons);
                setShowButtons(!showButtons);
            }
        };
        // @ts-ignore
        window.addEventListener("keyup", handler, false);
        return () => {
            // @ts-ignore
            window.addEventListener("keyup", handler, false);
        };
    }, [showButtons]);

    if(sourcesError || chartsError) {
        return <div>failed to load</div>
    }
    if(!sourcesData || !chartsData) {
        return <LoadingBar className="main-loader"/>
    }

    const {charts} = chartsData as {charts: Chart[]}


    const sources = sourcesData?.sources ?? [];

    async function updateStats() {
        await fetchApi(`/refresh`, {method: "POST"});
    }

    if (sourcesError || !sourcesData) return null;
    setInterval(refresh, 1000 * 60 * 5);


    return (
        <main>
            {showButtons && <div className="buttons">
                <button className="panel-btn" onClick={refresh}>Refresh</button>
                {sources.map((source) => (<SourceButton key={source} source={source}/>))}
                <button className="panel-btn" onClick={updateStats}>Check for stats update</button>
            </div>}

            <div className="sparklines">
                {charts.filter(chart => chart.type === "sparkline").map(chart => <ChartGraph refreshKey={refreshKey} chart={chart} key={chart.title + ":" + chart.subTitle}/>)}
            </div>
            <div className="panels">
                {charts.filter(chart => chart.type !== "sparkline").map(chart => <ChartGraph refreshKey={refreshKey} chart={chart} key={chart.title + ":" + chart.subTitle}/>)}
            </div>
        </main>
    )
}
