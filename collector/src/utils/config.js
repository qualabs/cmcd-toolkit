import { config } from "dotenv";

config()
config({ path: `.env.local`, override: true });

export const env = process.env
export const PORT = process.env.PORT || 3000;

//BigQuery
export const BIGQUERY_ENABLED = process.env.BIGQUERY_ENABLED == 'true'
export const BIGQUERY_DATASET = process.env.BIGQUERY_DATASET;
export const BIGQUERY_TABLE = process.env.BIGQUERY_TABLE;

//PubSub
export const PUBSUB_ENABLED = process.env.PUBSUB_ENABLED == 'true'
export const PUBSUB_TOPIC_NAME = process.env.PUBSUB_TOPIC_NAME;
export const PUBSUB_USE_SCHEMA = process.env.PUBSUB_USE_SCHEMA == 'true';

//Fluentd
export const LOCAL_ENABLED = process.env.LOCAL_ENABLED == 'true'
export const LOCAL_FLUENTD_HOST = process.env.LOCAL_FLUENTD_HOST;
export const LOCAL_FLUENTD_PORT = process.env.LOCAL_FLUENTD_PORT;
export const LOCAL_FLUENTD_TAG = process.env.LOCAL_FLUENTD_TAG;