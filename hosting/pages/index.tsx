import useSWR from "swr";
import {apiToken, fetchApi, fetcher} from "../lib/fetcher";
import React, {useEffect} from "react";
import Source from "../components/source";
import SourceButton from "../components/sourcebutton";
import {titleCase} from "../lib/chartUtils";

const refreshInterval = 1000 * 60 * 10;
const DEFAULT_AGGREGATE = 100;

export default function IndexPage() {
    const {data: sourcesData, error: sourcesError} = useSWR(`/sources?apiKey=${apiToken}`, fetcher);
    const [forceUpdateHack, setForceUpdateHack] = React.useState(false);
    const [aggregate, setAggregate] = React.useState<number|null>(DEFAULT_AGGREGATE);

    const [chartToSubchartNames, setChartToSubchartNames] = React.useState({});
    const [chartToSubchartNameToSeries, setChartToSubChartNameToSeries] = React.useState({});
    const [chartToIsLoading, setChartToIsLoading] = React.useState({});


    const sources = sourcesData?.sources ?? [];

    async function refresh() {
        await fetchApi(`/refresh`, {method: "POST"});
    }


    async function fetchData(source) {
        const {
            series: subCharts,
            stats: datapoints
        } = await fetchApi(`/stats/${source}` + (aggregate ? `?aggregate=true&buckets=${aggregate}` : "")).then(response => response.json());
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

    useEffect(() => {
        for(const source of sources) {
            fetchData(source);
        }
        const interval = setInterval(() => {
            for(const source of sources) {
                fetchData(source);
            }
        }, refreshInterval);

        return () => clearInterval(interval); // This represents the unmount function, in which you need to clear your interval to prevent memory leaks.
    }, [aggregate, sources]);

    if (sourcesError || !sourcesData) return null;



    return (
        <>
            <button onClick={refresh}>Check for stats update</button>
            {sources.map((source) => (<SourceButton key={source} source={source}/>))}
            <br/>
            <button onClick={() => setForceUpdateHack(!forceUpdateHack )}>Refresh Charts</button>
            <label>
                Aggregate?
                <input type="checkbox" checked={aggregate !== null} onChange={(e) => setAggregate(e.target.checked ? DEFAULT_AGGREGATE : null)}/>
            </label>
            {aggregate && <input type="number" value={aggregate} min={10} max={10000} step={10} onChange={(e) => setAggregate(parseInt(e.target.value))}/>}
            <div className="panels">
                {sources.map((source) => (<Source key={source + "-" + forceUpdateHack} source={source} subchartNames={chartToSubchartNames[source]} chartNameToSeries={chartToSubchartNameToSeries[source]} isLoading={chartToIsLoading[source]}/>))}
            </div>
        </>
    )
}
