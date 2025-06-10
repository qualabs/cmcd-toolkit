# Google Cloud BigQuery Schema Module (`gcloud-big-table`)

This README should help in understanding and utilizing the BigQuery schema for CMCD data within the project.

## Purpose and Functionality

This module, `gcloud-big-table`, provides the schema definition for storing Common Media Client Data (CMCD) v2 in **Google BigQuery**. While the directory name might suggest Google Cloud Bigtable, the current implementation and provided schema file (`bigquery-cmcdv2-schema.json`) are specifically for Google BigQuery.

Google BigQuery is a highly scalable, serverless, and cost-effective multicloud data warehouse designed for business agility. In the context of the cmcd-toolkit, this module plays a crucial role in the Google Cloud flavor of the deployment by defining the structure of the table where CMCD data will be stored for analysis, visualization, and long-term retention.

The `bigquery-cmcdv2-schema.json` file contains an array of field definitions, each specifying the name, type (e.g., STRING, INTEGER, TIMESTAMP, BOOLEAN, FLOAT), mode (NULLABLE, REQUIRED), and a description for each data point collected via CMCD.

## Customization

Customizing this module primarily involves modifying the BigQuery table schema to suit specific data storage or analytical needs.

### Modifying the Schema (`bigquery-cmcdv2-schema.json`)

The `bigquery-cmcdv2-schema.json` file dictates the structure of your CMCD data table in BigQuery. You can customize it by:

*   **Adding New Fields:** If you need to store additional CMCD fields (perhaps custom keys or new standardized ones) or derived metadata, add a new JSON object to the array.
    ```json
    {
      "name": "cmcd_key_my_custom_field",
      "type": "STRING",
      "mode": "NULLABLE",
      "description": "Description of my custom field."
    }
    ```
*   **Modifying Existing Fields:** You can change the `type`, `mode`, or `description` of existing fields. However, be cautious with type changes on existing tables with data, as BigQuery has rules for schema updates (e.g., widening types like INT to FLOAT is often allowed, but changing STRING to INTEGER is not directly possible without data migration).
*   **Removing Fields:** If certain fields are not needed, you can remove their definition from the JSON array. This will mean new data won't include these fields. Existing data in BigQuery will retain the columns, but they will be null for new entries not providing them.

**Applying Schema Changes:**
*   **New Table:** If you are creating a new BigQuery table, this schema will be used during the table creation process (e.g., via `bq mk` command-line tool, or through Google Cloud Console, or programmatically by the collector/data pipeline).
*   **Existing Table:** If the table already exists, you might need to use BigQuery's schema update mechanisms. Some changes (like adding nullable columns) are straightforward. More complex changes might require table recreation or data migration scripts.

### Configuring BigQuery Dataset and Table

While the schema is defined here, the actual BigQuery dataset and table names that the `collector` module (or other data ingestion services) will use are typically configured via environment variables in those services (e.g., `BIGQUERY_DATASET_ID`, `BIGQUERY_TABLE_ID` for the collector). Ensure these configurations match the dataset and table where you intend to apply this schema.

## Ideas for Customization

*   **Support for New or Custom CMCD Fields:** As the CMCD specification evolves or your application uses custom CMCD keys, update the schema to include these new data points.
*   **Add Derived or Enriched Fields:**
    *   Include fields that are not directly from CMCD but are derived during processing (e.g., session duration, rebuffering ratio).
    *   Add fields for enriched data, like geo-location information derived from IP addresses.
*   **Implement Table Partitioning and Clustering:**
    *   To improve query performance and manage costs, consider partitioning your BigQuery table (e.g., by `request_datetime` or `cmcd_key_ts_date`).
    *   Add clustering on frequently filtered columns (e.g., `cmcd_key_sid`, `cmcd_key_cid`, `cmcd_key_ot`). These strategies are not defined in the schema JSON itself but are applied when creating or modifying the table that uses this schema.
*   **Integration with Other Google Cloud Services:**
    *   Use this schema as a basis for creating views or materialized views in BigQuery for specific analytical purposes.
    *   Connect Data Studio or Looker to tables using this schema for visualization and dashboarding.
    *   Feed data from tables with this schema into Google AI Platform or Vertex AI for machine learning tasks (e.g., predicting stream quality issues).
*   **Schema Versioning:** If you anticipate frequent changes, implement a schema versioning strategy. This could involve adding a `schema_version` field to your data or maintaining different tables/schemas for different versions.

## Usage

This schema file (`bigquery-cmcdv2-schema.json`) is intended to be used by:

*   **Deployment Scripts:** When setting up the Google Cloud infrastructure, scripts can use this file to create the BigQuery table.
*   **Data Ingestion Services:** The `collector` module (when configured for BigQuery) or other data loading processes will format CMCD data according to this schema before inserting it into BigQuery.
*   **Data Consumers:** Analysts or applications querying the data will refer to this schema to understand the table structure.

Ensure that any tool or service interacting with the CMCD BigQuery table is compatible with the schema defined in this module.
