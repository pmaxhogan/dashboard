import React from "react";
import {apiBase} from "../lib/fetcher";


export default function SourceButton({source}) {
    function authorize() {
        window.open(`${apiBase}/api/login/${source.toLowerCase()}`, "_blank");
    }

    return <>
        <button onClick={authorize}>Authorize {source.toLowerCase()}</button>
    </>;
}

