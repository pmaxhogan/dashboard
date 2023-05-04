# Dashboard
## New source
```js
use homepage;
db.createCollection("X", {timeseries: {timeField: "timestamp", metaField: "metadata", granularity: "seconds"}})
```
