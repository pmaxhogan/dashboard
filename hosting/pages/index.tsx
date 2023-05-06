import useSWR from "swr";
import {fetchApi, fetcher} from "../lib/fetcher";
import React from "react";
import Source from "../components/source";
import SourceButton from "../components/sourcebutton";


const DEFAULT_AGGREGATE = 300;

export default function IndexPage() {
    const {data: sourcesData, error: sourcesError} = useSWR(`/sources`, fetcher);
    const [forceUpdateHack, setForceUpdateHack] = React.useState(false);
    const [aggregate, setAggregate] = React.useState<number|null>(DEFAULT_AGGREGATE);
    if (sourcesError || !sourcesData) return null;
    const sources = sourcesData.sources;

    async function refresh() {
        await fetchApi(`/refresh`, {method: "POST"});
    }

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
            <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(500px, 1fr))"}}>
                {sources.map((source) => (<Source key={source + "-" + forceUpdateHack} source={source} aggregate={aggregate}/>))}
            </div>
        </>
    )
}
