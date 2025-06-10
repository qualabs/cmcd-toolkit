# Google Cloud Collector Function Module

This README provides a guide for understanding, customizing, and deploying the serverless CMCD collector function.

## Purpose and Functionality

The `gcloud-collector-function` module provides a serverless HTTP endpoint for collecting Common Media Client Data (CMCD) v2 on Google Cloud. It is designed as a Google Cloud Function, offering a scalable, cost-effective, and managed solution for CMCD data ingestion.

Key functionalities include:

*   **HTTP Trigger:** The function is triggered by HTTP requests, making it accessible via a public URL once deployed.
*   **CMCD Data Reception:**
    *   **Event Mode (GET):** Accepts CMCD data encoded as query parameters in a GET request (e.g., `?CMCD=key1=value1,key2="stringValue"`).
    *   **Response Mode (POST):** Accepts CMCD data as a JSON payload in the body of a POST request. This can be a single JSON object or an array (batching) of objects.
    *   The specific mode is determined by the request path: `/cmcd/event-mode` or `/cmcd/response-mode`.
*   **Data Parsing and Enrichment:**
    *   Parses incoming CMCD data (both query strings and JSON) into a structured JSON format.
    *   Enriches the data with additional request metadata such as User-Agent, client IP address, request origin, and a server-side timestamp.
    *   Adds a `cmcd_key_ts_date` field by converting the `cmcd_key_ts` (if present and a number) into an ISO date string.
*   **Publishing to Pub/Sub:** Forwards the processed and enriched CMCD data to a configured Google Cloud Pub/Sub topic. This decouples the data collection from downstream processing and storage, allowing for flexible data pipelines (e.g., streaming to BigQuery, Cloud Storage, or other analytics services).
*   **CORS Support:** Handles Cross-Origin Resource Sharing (CORS) preflight OPTIONS requests and sets appropriate CORS headers to allow invocation from web-based video players.
*   **Error Handling:** Includes basic error handling and logging for request processing and Pub/Sub publishing.

This function serves as an alternative to the Docker-based `collector` module when a serverless architecture is preferred on Google Cloud.

## Customization

### Environment Variables

The primary way to configure the Cloud Function at runtime is through environment variables. These can be set during deployment or by modifying existing function configurations.

*   **`PUBSUB_TOPIC_NAME`**: (Required) The name of the Google Cloud Pub/Sub topic to which the CMCD data will be published.
    *   Default during development (if not set): `cmcd` (as seen in `index.js`)
    *   Set during deployment (example in `package.json`): `cmcd`

You might introduce other environment variables for further customization, such as:
*   `BIGQUERY_DATASET_ID` / `BIGQUERY_TABLE_ID`: If modifying the function to write directly to BigQuery.
*   `LOG_LEVEL`: To control log verbosity.

### Modifying Data Processing Logic (`index.js`)

The core data handling logic resides in `gcloud-collector-function/index.js`. You can customize it by:

*   **Changing Pub/Sub Topic Logic:** Modify how the `PUBSUB_TOPIC_NAME` is determined or add logic to publish to different topics based on request data.
*   **Altering Data Parsing/Validation:**
    *   Modify the `parseCMCDQueryToJson` function to support different query string formats or custom parsing rules.
    *   Add more sophisticated validation for CMCD keys and values against the specification or business rules.
*   **Custom Data Transformation/Enrichment:**
    *   Add, remove, or modify fields in the `dataToPublish` object. For example, perform geo-IP lookups or add other derived metrics.
*   **Error Handling:** Enhance error reporting, e.g., by sending notifications for critical failures.

### Deployment Configurations

When deploying the Google Cloud Function (e.g., using the `gcloud functions deploy` command shown in `package.json`'s `deploy` script), you can customize various parameters:

*   **`--runtime`**: Specify the Node.js runtime version (e.g., `nodejs22`).
*   **`--trigger-http`**: Defines it as an HTTP-triggered function.
*   **`--allow-unauthenticated`**: Controls whether the function can be invoked publicly. For production, you might want to secure it.
*   **`--entry-point`**: The name of the exported function in `index.js` to be executed (e.g., `cmcdProcessor`).
*   **`--region`**: The Google Cloud region where the function will be deployed.
*   **`--memory`**: Amount of memory allocated to the function (e.g., `256MB`).
*   **`--timeout`**: Maximum execution time for the function (e.g., `60s`).
*   **`--min-instances` / `--max-instances`**: Configure scaling properties.
*   **`--set-env-vars`**: Set environment variables for the deployed function.
*   **`--dockerfile` and `--source`**: If deploying from a local Dockerfile (as suggested by the presence of `Dockerfile`), these parameters would be relevant.

Refer to the [Google Cloud Functions documentation](https://cloud.google.com/functions/docs) for all available deployment options.

## Ideas for Customization

*   **Different Pub/Sub Topics:** Implement logic to route different types of CMCD events or data from different sources to separate Pub/Sub topics.
*   **Enhanced Data Validation:**
    *   Use a CMCD schema validator library to ensure data strictly conforms to the specification.
    *   Implement custom validation rules based on expected values for certain keys.
*   **Custom Authentication/Authorization:**
    *   If `--allow-unauthenticated` is not desired, implement authentication using Identity Platform, API Keys, or by integrating with an external OAuth provider.
    *   Check for specific tokens or headers for authorization before processing requests.
*   **Dead-Letter Queue (DLQ) for Pub/Sub:** Configure a DLQ for the Pub/Sub topic to capture messages that couldn't be processed successfully by subscribers, allowing for later analysis or reprocessing. This is configured on the Pub/Sub subscription, not directly in the function.

## Development and Testing

*   **Local Development:** Use the Google Cloud Functions Framework to run the function locally:
    ```bash
    npm start 
    ```
    This will typically start a local server (e.g., on port 8080) that emulates the Cloud Functions environment.
*   **Testing:** The module includes a Jest setup (`index.test.js`, `babel.config.cjs`). Run tests with:
    ```bash
    npm test
    ```
*   **Dependencies:** Install dependencies with `npm install`.

## Deployment

The `package.json` includes an example deployment script:

```bash
npm run deploy
# Which translates to:
# gcloud functions deploy cmcdProcessor --gen2 --runtime=nodejs22 --trigger-http --allow-unauthenticated --entry-point=cmcdProcessor --region=us-east1 --set-env-vars PUBSUB_TOPIC_NAME=cmcd 
```

Customize the parameters in this script (region, environment variables, etc.) as needed for your deployment.
