import prodConfig from "../prodConfig.js";
import fetch from "node-fetch";
import {debug} from "firebase-functions/logger";
import oauthSuccess from "../oauthSuccess.js";
import {StatSource} from "../StatSource.js";
import {Source} from "../chart.js";

prodConfig();

interface WeatherInfo {
    coord: {
        lon: number;
        lat: number;
    };
    weather: {
        id: number;
        main: string;
        description: string;
        icon: string;
    }[];
    base: string;
    main: {
        temp: number;
        feels_like: number;
        temp_min: number;
        temp_max: number;
        pressure: number;
        humidity: number;
        sea_level?: number;
        grnd_level?: number;
    };
    visibility: number;
    wind: {
        speed: number;
        deg: number;
        gust?: number;
    };
    rain?: {
        "1h": number;
    };
    snow?: {
        "1h": number;
    };
    clouds: {
        all: number;
    };
    dt: number;
    sys: {
        type: number;
        id: number;
        country: string;
        sunrise: number;
        sunset: number;
    };
    timezone: number;
    id: number;
    name: string;
    cod: number;
}

type WeatherStats = {
    temp: {
        temp: number,
        feels_like: number,
    },
    wind: {
        speed: number,
        gust: number,
        deg: number,
    }
}

export default new StatSource(1000 * 60 * 5, Source.WEATHER,
    async () => {
        const req = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${process.env.OPENWEATHER_LOCATION}&APPID=${process.env.OPENWEATHER_API_KEY}&units=imperial`);
        const weather = await req.json() as WeatherInfo;

        debug("Weather got stats", {
            location: "weather.refresh",
            weather
        });

        const stats = {
            temp: {
                temp: weather.main.temp,
                feels_like: weather.main.feels_like,
            },
            wind: {
                speed: weather.wind.speed,
                gust: weather.wind.gust,
                deg: weather.wind.deg,
            }
        } as WeatherStats;

        debug("Weather built stats", {
            location: "weather.refresh",
            stats
        });

        return {
            stats
        };
    },
    async (req, res) => {
        return oauthSuccess(req, res);
    },
    async (req, res) => {
        return oauthSuccess(req, res);
    }
);
