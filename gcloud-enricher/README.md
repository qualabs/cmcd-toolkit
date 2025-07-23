# gcloud-enricher

This service enriches the CMCD.
 - Can add data with GeoIP information.
 - Can parse user agent data
 - Can remove some keys if you dont want to store them in DB

## Google Cloud Configuration

1.  **Create a Pub/Sub topic:**
    *   Go to the Pub/Sub section in the Google Cloud Console.
    *   Create a new topic (e.g., `cmcd-data`).
    *   This topic will be used to trigger the enricher function.

2.  **Deploy the function:**
    *   Go to the Cloud Functions section in the Google Cloud Console.
    *   Create a new function.
    *   Select the `Pub/Sub` trigger and choose the topic you created in the previous step.
    *   Select the `Node.js` runtime.
    *   Copy the code from `index.js` into the inline editor.
    *   Copy the `package.json` content into the `package.json` tab.
    *   Set the entry point to `enrichCmcd`.

## GeoIP Database Configuration

1.  **Create a Google Cloud Storage bucket:**
    *   Go to the Cloud Storage section in the Google Cloud Console.
    *   Create a new bucket (e.g., `cmcd-geoip-databases`).

2.  **Upload the GeoIP databases:**
    *   Download the `GeoLite2-City.mmdb` and `GeoLite2-ASN.mmdb` databases from [MaxMind](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data).
    *   Upload the databases to the bucket you created.

## Environment Variables

The following environment variables need to be configured for the function:

*   `BUCKET_NAME`: The name of the bucket where the GeoIP databases are stored.
*   `GEOLITE2_CITY_FILE`: The name of the GeoIP city database file (e.g., `GeoLite2-City.mmdb`).
*   `GEOLITE2_ASN_FILE`: The name of the GeoIP ASN database file (e.g., `GeoLite2-ASN.mmdb`).
*   `PUBSUB_OUTPUT_TOPIC_NAME`: The name of the Pub/Sub topic to publish the enriched data to (e.g., `cmcd-enriched-data`).
*   `FILTER_DATA`: Coma separated list of fields to remove before publishing.
*   `PARSE_USER_AGENT`: Set 'true' if you want to parse the User Agent.
