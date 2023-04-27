export const fetcher = (url: string) => fetch(url).then((res) => res.json());
export const fetcherMultiple = async ({urls}) => {
    const requests = urls.map(url => fetch(url));
    const responses = await Promise.all(requests);
    const jsons = responses.map(response => response.json());
    return Promise.all(jsons);
}

export const apiBase = (process.env.NODE_ENV === "development" && false) ? "http://localhost:5001/peaceful-access-dashboard/us-central1/api" : "https://us-central1-peaceful-access-dashboard.cloudfunctions.net/api";