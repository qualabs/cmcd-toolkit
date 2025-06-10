# Fluentd Module

This README provides a guide to understanding and customizing the `fluentd` module. Refer to the official [Fluentd documentation](https://docs.fluentd.org/) for more comprehensive information on configuration and plugin development.

## Purpose and Functionality

The `fluentd` module in the cmcd-toolkit acts as a flexible log aggregation and forwarding layer. Fluentd is an open-source data collector that allows you to unify data collection and consumption for better use and understanding of data.

In the context of this project, its primary roles are:

*   **Receiving CMCD Data from Collector:** It's configured to receive structured log data (specifically CMCD data) from the `collector` module. The `collector` forwards data to Fluentd's input plugin.
*   **Data Buffering and Routing:** Fluentd can buffer the incoming data and then route it to various destinations (outputs) based on tags or other conditions.
*   **Output to Backends:** In the default configuration (`fluent.conf`), this module is set up to forward the CMCD data to an InfluxDB instance. This allows for time-series analysis and visualization of the CMCD metrics. However, Fluentd's strength lies in its ability to be configured to send data to a wide array of backends.

This module is typically used in the local Docker Compose setup (`docker-compose.local.yml`) to decouple the `collector` from the final data storage and to enable more complex data pipelines.

## Customization

The behavior of the Fluentd module is primarily controlled by its configuration file (`fluent.conf`) and by adding or configuring Fluentd plugins.

### Modifying `fluent.conf`

The `fluentd/fluent.conf` file is the heart of the Fluentd module. You can modify it to change how data is collected, processed, and dispatched. The file consists of several types of directives:

*   **`<source>` Directives:** Define how Fluentd collects data.
    *   Example: The default configuration uses `@type forward` to listen for TCP/IP packets from the collector. You could add other sources to collect logs from files, other services, or system logs.

*   **`<filter>` Directives (Optional):** Define processing pipelines for events. Filters are applied to events before they are sent to `<match>` directives.
    *   Example: You could add a filter to parse specific fields from the log, add new fields, or mask sensitive information.
      ```conf
      <filter node.collector.**>
        @type record_transformer
        <record>
          new_field "processed_by_fluentd"
        </record>
      </filter>
      ```

*   **`<match>` Directives:** Define how Fluentd routes and outputs data. Events are routed to `<match>` directives based on their tags.
    *   Example: The default configuration uses `@type influxdb` to send data tagged with `node.collector.**` to an InfluxDB instance. You can change the output plugin, its parameters, or add more `<match>` blocks to send data to multiple destinations.
      ```conf
      # Example: Send the same data to standard output (console) for debugging
      <match node.collector.**>
        @type copy
        <store>
          @type influxdb
          host "#{ENV['INFLUXDB_HOST'] || 'influxdb'}"
          # ... other influxdb params
        </store>
        <store>
          @type stdout
        </store>
      </match>
      ```

**Environment Variables in `fluent.conf`:**
As seen in the default `fluent.conf`, you can use `#{ENV['YOUR_ENV_VAR'] || 'default_value'}` syntax to make your Fluentd configuration more flexible and controllable via environment variables passed to the Fluentd container.

### Adding New Fluentd Plugins

Fluentd has a rich ecosystem of plugins for various inputs, filters, and outputs. If you need to integrate with a service or process data in a way not supported by the default plugins, you can add new ones.

To add a new plugin:

1.  **Identify the plugin:** Find the required plugin on the Fluentd plugin directory or GitHub.
2.  **Update the Dockerfile:** Add the installation command for the new plugin to the `fluentd/Dockerfile`. Plugins are typically installed using `fluent-gem install <plugin-name>`.
    ```dockerfile
    FROM fluent/fluentd:v1.16-1

    # Add your plugins here
    USER root
    RUN fluent-gem install fluent-plugin-elasticsearch \
        && fluent-gem install fluent-plugin-rewrite-tag-filter
    USER fluent
    
    # ... rest of the Dockerfile
    ```
3.  **Rebuild the Docker image:** `docker compose build fluentd` (or the equivalent command for your Docker environment).
4.  **Configure the plugin:** Use the newly installed plugin in your `fluent.conf` by specifying its `@type` and other configuration parameters as per the plugin's documentation.

## Ideas for Customization

*   **Send Data to Different Analytics Platforms:**
    *   Configure output plugins for Elasticsearch, Splunk, Datadog, Kafka, or cloud-specific services like AWS S3, Google Cloud Storage, or Azure Blob Storage.
*   **Implement Custom Parsing Rules:**
    *   If the `collector` module starts sending logs in a different format (not JSON), you can add or modify `<parse>` directives within your `<source>` or `<filter>` blocks to correctly process them.
*   **Set Up Alerts Based on Specific Log Patterns:**
    *   Use plugins like `fluent-plugin-grepcounter` or `fluent-plugin-Notifier` (with appropriate output plugins like `fluent-plugin-slack` or `fluent-plugin-pagerduty`) to count occurrences of specific errors or patterns and send alerts.
*   **Data Enrichment:**
    *   Use the `record_transformer` filter to add metadata to logs, such as geo-IP information based on client IP addresses.
*   **Advanced Log Filtering and Routing:**
    *   Use plugins like `fluent-plugin-rewrite-tag-filter` to re-tag events based on their content, allowing for more granular routing to different output destinations.
*   **Multi-Format Output:**
    *   Configure Fluentd to output data in multiple formats (e.g., JSON for one system, plain text for another) using the `copy` output plugin.

## Building and Running

The `fluentd` module is typically built and run as part of the Docker Compose setup defined in the main project directory (e.g., `docker-compose.local.yml`). You can rebuild the Fluentd image specifically if you make changes to its `Dockerfile` or add plugins:

```bash
docker compose build fluentd
docker compose up fluentd 
# Or, to restart all services defined in your compose file:
# docker compose up -d --force-recreate --build
```

Ensure that any services Fluentd depends on (like InfluxDB in the default configuration) are also running.
