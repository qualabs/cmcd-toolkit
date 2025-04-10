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