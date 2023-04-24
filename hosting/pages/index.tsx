import useSWR from "swr";
import {apiBase, fetcher} from "../lib/fetcher";
import React from "react";
import Source from "../components/source";



export default function IndexPage() {
    const {data: sourcesData, error: sourcesError} = useSWR(`${apiBase}/api/sources`, fetcher);
    if(sourcesError || !sourcesData) return null;
    const sources = sourcesData.sources;

    return (
    <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(500px, 1fr))"}}>
        {sources.map((source) => (<Source key={source} source={source} />))}
    </div>
  )
}
