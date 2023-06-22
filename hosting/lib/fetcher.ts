export const fetcher = (url: string) => fetchApi(url).then((res) => res.json());
export const fetcherMultple = async ({urls}) => {
    const requests = urls.map(url => fetchApi(url));
    const responses = await Promise.all(requests);
    const jsons = responses.map(response => response.json());
    return Promise.all(jsons);
}

export const apiBase = process.env.NODE_ENV === "development" ? "http://localhost:5001/peaceful-access-dashboard/us-central1/api" : "https://us-central1-peaceful-access-dashboard.cloudfunctions.net/api";
export const apiToken = "05c5969e4bb023de9970f9bded75b11005f42c44a070c2c1e6808c757357eaed";
export function fetchApi(path: string, options?: any) {
    return fetch(`${apiBase}${path}`, {
        ...options,
        headers: {
            ...options?.headers,
            "Authorization": apiToken
        }
    });
}