import React from "react";


export default function SourceButton({source}) {
    function authorize() {
        window.open(`/login/${source.toLowerCase()}`, "_blank");
    }

    return <>
        <button onClick={authorize}>Authorize {source.toLowerCase()}</button>
    </>;
}

