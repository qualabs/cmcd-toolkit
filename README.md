# CMCD Data Monitoring Stack

This project provides a Docker Compose setup for collecting and visualizing CMCD (Common Media Client Data) using Fluentd, InfluxDB, and Grafana.

## Services

The `docker-compose.yml` will start the following services:

*   **Collector:** (Port 3000) The application responsible for receiving or generating CMCD data. Logs from this service are sent to Fluentd.
*   **Fluentd:** (Port 24224) Receives logs from the Collector, processes them, and forwards them to InfluxDB.
*   **InfluxDB:** (Port 8086) Time-series database used to store the CMCD data.
    *   Initialized with:
        *   Organization: `my-org`
        *   Bucket: `my-bucket`
        *   Admin Username: `admin`
        *   Admin Password: `password`
        *   Admin Token: `my-super-secret-admin-token` (defined in `docker-compose.yml`)
*   **Grafana:** (Port 8081) Visualization platform.
    *   Default admin user: `admin`
    *   Default admin password: `grafana` (defined in `docker-compose.yml`)
    *   Pre-configured with a datasource pointing to the InfluxDB service.

## Prerequisites

*   Docker (https://docs.docker.com/get-docker/)
*   Docker Compose (https://docs.docker.com/compose/install/)

## How to Run

1.  **Clone the repository.**
2.  **Navigate to the project directory.**
3.  **Start the services:**
    ```bash
    docker-compose up -d
    ```
    This will start all services in detached mode.

4.  **Access Grafana:**
    Open your browser and go to `http://localhost:8081`. Log in with the default credentials (`admin`/`grafana`). You should find the InfluxDB datasource already configured and be able to create dashboards to query data from the `my-bucket` bucket in the `my-org` organization.

5.  **Access InfluxDB UI (optional):**
    InfluxDB 2.x has its own UI, accessible at `http://localhost:8086`. You can log in with `admin`/`password` to manage the database, tokens, etc.

6.  **Collector Endpoint:**
    The data collector service is available at `http://localhost:3000`. (Further details about its API and how to send data to it should be in `collector/README.md`).

## How to Stop

To stop all running services:
```bash
docker-compose down
```
To stop and remove volumes (e.g., InfluxDB data):
```bash
docker-compose down -v
```

## Development

*   **Collector Service:** The collector service is built from the `./collector` directory. If you make changes to the collector's source code, you will need to rebuild the collector's image:
    ```bash
    docker-compose build collector
    ```
    Then restart the services:
    ```bash
    docker-compose up -d --no-deps collector # To restart only the collector
    # Or restart all:
    # docker-compose up -d
    ```
    Refer to `collector/README.md` for more details on collector development, including the use of `.env` files for local configuration.

*   **Fluentd Configuration:** Fluentd configuration is in `fluentd/fluent.conf`. If you modify this file, restart Fluentd:
    ```bash
    docker-compose restart fluentd
    ```

*   **Grafana Dashboards/Datasources:** Grafana's datasource is provisioned from `grafana/datasource.yml`. Dashboards can be created in the UI and exported to JSON files in a `grafana/dashboards/` directory (and provisioned via `grafana/dashboard.yml` if desired, though this is not set up yet).

## BigQuery Integration
The collector and Grafana services are still configured with BigQuery secrets and settings. If BigQuery integration is actively used, ensure your `secrets/bigquery_secret.json` and `secrets/bigquery_secret.pem` are correctly set up. The CMCD data pipeline set up by this Docker Compose configuration uses InfluxDB.