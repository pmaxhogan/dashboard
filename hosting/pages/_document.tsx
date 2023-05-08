// pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document'
import React from "react";

export default function Document() {
    return (
        <Html>
            <Head>
                <link rel="preconnect" href="https://fonts.googleapis.com" key="pc-font"/>
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" key="pc-font-2"/>
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@500&display=swap" rel="stylesheet" key="font"/>
            </Head>
            <body>
            <Main />
            <NextScript />
            </body>
        </Html>
    )
}
