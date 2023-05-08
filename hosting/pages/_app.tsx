import "../index.css";
import type { AppProps } from 'next/app';
import React from "react";
import Head from "next/head";

export default function MyApp({Component, pageProps}: AppProps) {
    return <main>
        <Head>
            <link rel="preconnect" href="https://fonts.googleapis.com" key="pc-font"/>
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" key="pc-font-2"/>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@500&display=swap" rel="stylesheet" key="font"/>
        </Head>
        <Component {...pageProps} />
    </main>;
}