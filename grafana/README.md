# Grafana Module

This README should guide users in understanding, configuring, and extending the Grafana module for CMCD data visualization.

## Purpose and Functionality

The `grafana` module within the cmcd-toolkit is responsible for visualizing Common Media Client Data (CMCD). Grafana is an open-source platform for monitoring and observability that allows you to query, visualize, alert on, and explore your metrics no matter where they are stored.

In this project, Grafana provides:

*   **Dashboards:** Pre-built dashboards to display key CMCD metrics, offering insights into video playback quality, CDN performance, and player behavior.
*   **Data Source Integration:**
    *   **Local Stack:** Connects to an InfluxDB instance (expected to be running alongside in the Docker environment) to visualize data collected by the `collector` and forwarded by `fluentd`.
    *   **Google Cloud (gcloud) Stack:** Connects directly to Google BigQuery to visualize CMCD data stored there.
*   **Extensibility:** Allows for the creation of new dashboards and integration with various data sources and notification channels.

This module contains configurations for both a local Docker-based setup and a Google Cloud deployment.

## Structure

*   `local-stack/`: Contains configurations for running Grafana with a local InfluxDB backend.
    *   `datasource.yml`: Provisions the InfluxDB data source.
    *   `dashboards/`: Contains JSON definitions for pre-built dashboards (e.g., `cmcd-dashboard.json`, `buffer-drain.json`).
    *   `dashboards/dashboards.yml`: Configures Grafana to automatically load dashboards from the `dashboards/` directory.
*   `gcloud-stack/`: Contains configurations for running Grafana with Google BigQuery as the backend.
    *   `datasource.yml`: Provisions the Google BigQuery data source, typically configured to use a service account for authentication.

## Customization

### Configuring Data Sources

Data sources define how Grafana connects to your databases (InfluxDB, BigQuery, etc.).

*   **Local Stack (`local-stack/datasource.yml`):**
    *   Modifies connection details for InfluxDB if your local setup differs (e.g., different InfluxDB service name, port, or database).
    ```yaml
    apiVersion: 1
    datasources:
    - name: InfluxDB
      type: influxdb
      access: proxy
      url: http://influxdb:8086 # Your InfluxDB URL
      database: analytics        # Your InfluxDB database name
      isDefault: true
    ```
*   **Google Cloud Stack (`gcloud-stack/datasource.yml`):**
    *   Modifies connection details for Google BigQuery. This is crucial for connecting to your specific GCP project and BigQuery instance.
    *   You'll need to update `clientEmail`, `defaultProject`, and ensure the `privateKeyPath` correctly points to the service account key file (often mounted as a secret in Docker/Kubernetes).
    ```yaml
    apiVersion: 1
    datasources:
    - name: BigQuery DS
      type: grafana-bigquery-datasource
      editable: true
      enabled: true
      jsonData:
        authenticationType: jwt
        clientEmail: your-service-account-email@your-gcp-project.iam.gserviceaccount.com
        defaultProject: your-gcp-project-id
        tokenUri: https://oauth2.googleapis.com/token
        privateKeyPath: /path/to/your/service-account-key.json # Ensure this path is accessible within the Grafana container
    ```
    This file is typically used when building a custom Grafana Docker image or when deploying Grafana with provisioning.

### Creating or Modifying Dashboards

Dashboards are defined as JSON files. You can find examples in `grafana/local-stack/dashboards/`.

*   **Modifying Existing Dashboards:**
    1.  Export the dashboard JSON from the Grafana UI:
        *   Open the dashboard in Grafana.
        *   Click the "Share" icon.
        *   Go to the "Export" tab.
        *   Click "Save to file" or "View JSON" and copy the content.
    2.  Replace the content of the corresponding JSON file in the `dashboards/` directory.
*   **Creating New Dashboards:**
    1.  Create a new dashboard in the Grafana UI.
    2.  Configure panels, queries, and visualizations as needed.
    3.  Export the dashboard JSON as described above.
    4.  Save the JSON as a new file in the `grafana/local-stack/dashboards/` directory (for the local stack).
    5.  Ensure the `grafana/local-stack/dashboards/dashboards.yml` provider can pick up your new dashboard (it usually loads all `.json` files in the specified path).

**Dashboard JSON Structure:**
Dashboard JSON files define panels, data queries, variables, visualization options, and layout. Understanding this structure (though complex) allows for fine-grained control. Refer to the [Grafana documentation on JSON Dashboards](https://grafana.com/docs/grafana/latest/dashboards/json-model/) for details.

### Installing Grafana Plugins

Grafana's functionality can be extended with plugins for new data sources, panel types, or applications.

To install a plugin (typically when building a custom Grafana Docker image or if you have shell access to your Grafana instance):

1.  Find the plugin ID from the [Grafana Plugin Catalog](https://grafana.com/grafana/plugins/).
2.  Add the installation command to your Grafana Dockerfile or run it in the Grafana container. The method depends on your Grafana setup. For Docker, you might set the `GF_INSTALL_PLUGINS` environment variable:
    ```Dockerfile
    FROM grafana/grafana:latest
    ENV GF_INSTALL_PLUGINS="your-plugin-id,another-plugin-id"
    ```
    Or, if building from a custom Dockerfile, you can use `grafana-cli`:
    ```Dockerfile
    FROM grafana/grafana:latest
    USER root
    RUN grafana-cli plugins install your-plugin-id
    USER grafana
    ```
    Or, just add the plugin list in the Docker Compose file.
3.  Restart Grafana to load the new plugin.
4.  Configure and use the plugin (e.g., add a new data source type or panel).

## Ideas for Customization

*   **Create New Dashboards:**
    *   Design dashboards focused on specific CMCD metrics like startup time, rebuffering ratios, playback errors, or CDN performance.
    *   Develop dashboards tailored to different user roles (e.g., operations, engineering, business analytics).
*   **Integrate with Alerting Systems:**
    *   Configure Grafana alerting to send notifications to Slack, PagerDuty, email, or other systems when specific thresholds are breached (e.g., high error rates, low buffer levels).
*   **Customize Visual Appearance:**
    *   Change themes, panel colors, and graph styles to match branding or improve readability.
    *   Use different visualization types (e.g., heatmaps, gauges, bar charts) offered by Grafana or through plugins.
*   **Add Annotations:**
    *   Use annotations to mark important events on your graphs, such as deployments, feature releases, or known incidents, to correlate them with metric changes.
*   **Template Variables:**
    *   Implement dashboard template variables to create dynamic dashboards where users can select filters like Content ID, CDN, or player version.
*   **Cross-Data Source Queries (if applicable):**
    *   If you have related data in different data sources, use Grafana's mixed data source capabilities to combine them on a single dashboard.

## Running Grafana

Grafana is typically run as part of the Docker Compose setup defined in the main project directory (e.g., `docker-compose.local.yml` or a similar file for the Google Cloud stack if Grafana is containerized there).

*   **Local Stack:** The `docker-compose.local.yml` usually includes a Grafana service, pre-configured to use the local-stack provisioning.
*   **Google Cloud Stack:** Grafana might be deployed as a container on Google Cloud (e.g., on GKE or Cloud Run) using the configurations in `gcloud-stack/`. Alternatively, you might connect a managed Grafana instance to your BigQuery data source.

Refer to the main project's README for instructions on how to start the services using Docker Compose.
