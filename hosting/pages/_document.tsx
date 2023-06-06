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

                <meta name="application-name" content="PWA App" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <meta name="apple-mobile-web-app-title" content="PWA App" />
                <meta name="description" content="Best PWA App in the world" />
                <meta name="format-detection" content="telephone=no" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="msapplication-config" content="/icons/browserconfig.xml" />
                <meta name="msapplication-TileColor" content="#2B5797" />
                <meta name="msapplication-tap-highlight" content="no" />
                <meta name="theme-color" content="#000000" />

                <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
                <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="shortcut icon" href="/favicon.ico" />
                <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />

                <meta name="twitter:card" content="summary" />
                <meta name="twitter:url" content="https://peaceful-access-dashboard.web.app" />
                <meta name="twitter:title" content="Dashboard" />
                <meta name="twitter:description" content="Dashboard" />
                <meta name="twitter:image" content="https://peaceful-access-dashboard.web.app/icons/android-chrome-192x192.png" />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="PWA App" />
                <meta property="og:description" content="Best PWA App in the world" />
                <meta property="og:site_name" content="PWA App" />
                <meta property="og:url" content="https://peaceful-access-dashboard.web.app" />
                <meta property="og:image" content="https://peaceful-access-dashboard.web.app/icons/icon-512x512.png" />
            </Head>
            <body>
            <Main />
            <NextScript />
            </body>
        </Html>
    )
}
