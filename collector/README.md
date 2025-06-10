# CMCD Collector Module

This README provides a starting point. Feel free to expand it with more specific details as the module evolves.

## Purpose and Functionality

The `collector` module is a core component of the cmcd-toolkit, designed to receive, process, and forward Common Media Client Data (CMCD) v2. It acts as a data ingestion point, capturing CMCD payloads sent from video players.

Key functionalities include:

*   **Receiving CMCD Data:** The collector exposes HTTP endpoints to receive CMCD v2 data. This data can be sent via query parameters or as a JSON payload in the request body.
*   **Data Parsing and Validation:** Incoming CMCD query parameters are parsed into a JSON format. Basic validation might be performed to ensure the data conforms to expected structures.
*   **Data Transformation:** The module can be configured to transform the CMCD data into a format suitable for the chosen backend.
*   **Data Forwarding:** Processed CMCD data is then forwarded to a configured backend for storage and analysis. Out-of-the-box, it supports:
    *   **Fluentd:** Forwards data to a Fluentd instance. In the typical local setup, Fluentd is configured to relay this data to InfluxDB for visualization with Grafana. Fluentd can be reconfigured to route to other destinations.
    *   **Google Cloud Pub/Sub:** Publishes data to a Google Cloud Pub/Sub topic, enabling integration with Google Cloud services like BigQuery.
    *   **Direct BigQuery Integration:** The collector might also support direct writing to BigQuery.

## Customization

The `collector` module is designed to be customizable to fit different deployment scenarios and data processing needs.

### Environment Variables

The primary way to configure the collector is through environment variables. You can set these variables in your deployment environment or by creating a `.env.local` file in the `collector` directory for local development (copy from `.env` as a template).

Commonly configurable variables (refer to `collector/.env` and `collector/src/utils/config.js` for a complete list)

### Configuration Files

*   **`collector/src/utils/config.js`**: This file might contain default configurations or logic for how environment variables are loaded and used. Modifications here can alter default behaviors if environment variables are not set.

### Data Processing Logic

*   **`collector/src/parseCMCDQueryToJson.js`**: Modify this file to change how CMCD query parameters are parsed and converted into JSON. You could add custom parsing rules or handle non-standard CMCD keys here.
*   **`collector/src/cmcd-extractor.service.js`**: This service likely contains the core logic for extracting and processing CMCD data. You can modify it to:
    *   Implement more sophisticated data validation rules.
    *   Add custom data enrichment or transformation steps before forwarding.
    *   Change how data is prepared for different backends.
*   **Backend Integration Files (`bigquery.js`, `fluentd.js`, `pubsub.js`):** To change how data is sent to a specific backend, or to add support for a new backend, you would modify these files or add new ones.

## Ideas for Customization

Here are some ideas for extending and customizing the `collector` module:

*   **Integrate with Different Data Storage Backends:**
    *   Add support for other databases like InfluxDB, Elasticsearch, or PostgreSQL.
    *   Implement a "dummy" backend that logs data to the console or writes to local files for quick testing.
*   **Add New Data Validation Rules:**
    *   Implement stricter validation against the CMCD v2 specification.
    *   Add business-specific validation rules (e.g., ensuring certain custom keys are present).
*   **Implement Custom Data Transformation Logic:**
    *   Anonymize or pseudonymize sensitive data fields.
    *   Aggregate or summarize data before storage.
    *   Convert data to a different format (e.g., Avro, Parquet) before sending to certain backends.
*   **Enhance Error Handling and Reporting:**
    *   Implement more detailed error logging.
    *   Add mechanisms to send alerts (e.g., via email or Slack) if data processing fails.
*   **Add Authentication/Authorization:**
    *   Secure the collector's API endpoints if they are exposed publicly.

## Development

To set up the collector for local development:

1.  Navigate to the `collector` directory.
2.  Copy the `.env` file to `.env.local`: `cp .env .env.local`
3.  Modify `.env.local` with your local configuration, such as Fluentd host/port or mock credentials if not connecting to live cloud services.
4.  Ensure necessary dependencies are installed (typically via `npm install` if running outside Docker).
5.  Run the collector (e.g., `npm start` or via Docker as defined in the main project's `docker-compose.yml`).

Refer to the main project README.md for instructions on running the entire cmcd-toolkit using Docker Compose.