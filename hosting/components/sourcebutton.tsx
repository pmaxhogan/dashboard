import React from "react";
import {apiBase, apiToken} from "../lib/fetcher";


export default function SourceButton({source}) {
    function authorize() {
        window.open(`${apiBase}/login/${source.toLowerCase()}?apiKey=${apiToken}`, "_blank");
    }

    return <>
        <button onClick={authorize}>Authorize {source.toLowerCase()}</button>
    </>;
}

