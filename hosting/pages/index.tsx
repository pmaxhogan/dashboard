import useSWR from "swr";
import {apiBase, fetcher} from "../lib/fetcher";
import React from "react";
import Source from "../components/source";
import SourceButton from "../components/sourcebutton";


export default function IndexPage() {
    const {data: sourcesData, error: sourcesError} = useSWR(`${apiBase}/sources`, fetcher);
    if (sourcesError || !sourcesData) return null;
    const sources = sourcesData.sources;

    function refresh() {
        window.open(`${apiBase}/refresh`, "_blank");
    }

    return (
        <>
            <button onClick={refresh}>Update Stats</button>
            {sources.map((source) => (<SourceButton key={source} source={source}/>))}
            <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(500px, 1fr))"}}>
                {sources.map((source) => (<Source key={source} source={source}/>))}
            </div>
        </>
    )
}
