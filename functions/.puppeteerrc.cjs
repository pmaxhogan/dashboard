const {join} = require('path');
const {mkdirSync} = require('fs');

mkdirSync("/tmp/dashboard-puppeteer", {recursive: true});

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Changes the cache location for Puppeteer.
    cacheDirectory: "/tmp/dashboard-puppeteer",
    // defaultProduct: "firefox",
};