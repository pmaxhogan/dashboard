import useSWR from "swr";
import {apiToken, fetchApi, fetcher} from "../lib/fetcher";
import React, {useEffect} from "react";
import Source from "../components/source";
import SourceButton from "../components/sourcebutton";
import {titleCase} from "../lib/chartUtils";
import Sparkline from "../components/sparkline";

const refreshInterval = 1000 * 60 * 10;
const DEFAULT_AGGREGATE = 100;

export default function IndexPage() {
    const {data: sourcesData, error: sourcesError} = useSWR(`/sources?apiKey=${apiToken}`, fetcher);
    const [forceUpdateHack, setForceUpdateHack] = React.useState(false);
    const [aggregate, setAggregate] = React.useState<number|null>(DEFAULT_AGGREGATE);

    const [chartToSubchartNames, setChartToSubchartNames] = React.useState({});
    const [chartToSubchartNameToSeries, setChartToSubChartNameToSeries] = React.useState({});
    const [chartToIsLoading, setChartToIsLoading] = React.useState({});
    const [sinceTime, setSinceTime] = React.useState(1);
    const [sinceUnits, setSinceUnits] = React.useState(null);


    const sources = sourcesData?.sources ?? [];

    async function refresh() {
        await fetchApi(`/refresh`, {method: "POST"});
    }


    async function fetchData(source) {
        const queryStr = sinceTime && sinceUnits ? `sinceTime=${sinceTime}&sinceUnits=${sinceUnits}` : "";

        const {
            series: subCharts,
            stats: datapoints
        } = await fetchApi(`/stats/${source}?${queryStr}` + (aggregate ? `&aggregate=true&buckets=${aggregate}` : "")).then(response => response.json());
        const subchartNames = Object.keys(subCharts);
        setChartToSubchartNames(newValues => ({...newValues, [source]: subchartNames}));
        setChartToSubChartNameToSeries(newValues => ({...newValues, [source]: subchartNames.reduce((acc, name, idx) => {
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
        }, {}) }));
        // setIsLoading(false);
        setChartToIsLoading(newValues => ({...newValues, [source]: false}));
    }


    function refreshCharts() {
        for(const source of sources) {
            fetchData(source);
        }
    }

    useEffect(() => {
        refreshCharts();
        const interval = setInterval(refreshCharts, refreshInterval);

        return () => clearInterval(interval); // This represents the unmount function, in which you need to clear your interval to prevent memory leaks.
    }, [aggregate, sources]);

    if (sourcesError || !sourcesData) return null;

    const sparklineData = [
        ["twitter.profile.followers", "Followers"],
        ["gmail.inbox.num_unread", "Unread Emails"],
        ["weather.temp.temp", "°F"],
        ["weather.wind.speed", "mph wind"],
        ["trello.total_time_in_label.school", "Homework"],
        ["trello.total_time_in_list.ready", "Ready"],
        ["trello.total_time_in_list.in_progress", "In Progress"],
        ["strava.allTime.distance", "mi on bike"],
    ];

    const sparklines = sparklineData.map(([name, friendlyName]) => {
        const source = name.split(".")[0].toUpperCase();
        const chart = name.split(".")[1];
        const seriesFriendly = titleCase(name.split(".")[2].toLowerCase());
        const series = chartToSubchartNameToSeries[source] && chartToSubchartNameToSeries[source][chart]?.filter(series => series.name === seriesFriendly);
        return series ? <Sparkline series={series} key={name} dataPath={name} friendlyName={friendlyName} isLoading={chartToIsLoading[source]}/> : null;
    });

    return (
        <>
            <button onClick={refresh}>Check for stats update</button>
            {sources.map((source) => (<SourceButton key={source} source={source}/>))}
            <br/>
            <button onClick={refreshCharts}>Refresh Charts</button>
            <label>
                Aggregate?
                <input type="checkbox" checked={aggregate !== null} onChange={(e) => setAggregate(e.target.checked ? DEFAULT_AGGREGATE : null)}/>
            </label>
            {aggregate && <input type="number" value={aggregate} min={10} max={10000} step={10} onChange={(e) => setAggregate(parseInt(e.target.value))}/>}

            <div className="sparklines">
                {sparklines}
            </div>
            <div className="panels">
                {sources.map((source) => (<Source key={source + "-" + forceUpdateHack} source={source} subchartNames={chartToSubchartNames[source]} chartNameToSeries={chartToSubchartNameToSeries[source]} isLoading={chartToIsLoading[source]}/>))}
            </div>
        </>
    )
}
