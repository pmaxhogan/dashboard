import useSWR from "swr";
import {apiBase, fetcher} from "../lib/fetcher";
import React from "react";
import Source from "../components/source";
import SourceButton from "../components/sourcebutton";


const DEFAULT_AGGREGATE = 100;

export default function IndexPage() {
    const {data: sourcesData, error: sourcesError} = useSWR(`${apiBase}/sources`, fetcher);
    const [aggregate, setAggregate] = React.useState<number|null>(null);
    if (sourcesError || !sourcesData) return null;
    const sources = sourcesData.sources;

    function refresh() {
        window.open(`${apiBase}/refresh`, "_blank");
    }

    return (
        <>
            <button onClick={refresh}>Update Stats</button>
            <label>
                Aggregate?
                <input type="checkbox" checked={aggregate !== null} onChange={(e) => setAggregate(e.target.checked ? DEFAULT_AGGREGATE : null)}/>
            </label>
            {aggregate && <input type="number" value={aggregate} min={10} max={10000} step={10} onChange={(e) => setAggregate(parseInt(e.target.value))}/>}
            {sources.map((source) => (<SourceButton key={source} source={source}/>))}
            <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(500px, 1fr))"}}>
                {sources.map((source) => (<Source key={source} source={source} aggregate={aggregate}/>))}
            </div>
        </>
    )
}
