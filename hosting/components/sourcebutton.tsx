import React from "react";
import {apiBase} from "../lib/fetcher";


export default function SourceButton({source}) {
    function authorize() {
        window.open(`${apiBase}/login/${source.toLowerCase()}?apiKey=${process.env.NEXT_PUBLIC_API_KEY}`, "_blank");
    }

    return <>
        <button onClick={authorize}>Authorize {source.toLowerCase()}</button>
    </>;
}

