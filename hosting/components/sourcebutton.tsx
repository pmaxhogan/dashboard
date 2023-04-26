import React from "react";
import {apiBase} from "../lib/fetcher";


export default function SourceButton({source}) {
    function authorize() {
        window.open(`${apiBase}/api/auth/${source}`, "_blank");
    }

    return <>
        <button onClick={authorize}>Authorize {source}</button>
    </>;
}

