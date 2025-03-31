import { config } from "dotenv";

config()
config({ path: `.env.local`, override: true });

export const env = process.env
export const PORT = process.env.PORT || 3000;
export const BIGQUERY_ENABLED = process.env.BIGQUERY_ENABLED == 'true'
export const BIGQUERY_DATASET = process.env.BIGQUERY_DATASET;
export const BIGQUERY_TABLE = process.env.BIGQUERY_TABLE;
export const BIGQUERY_CREDENTIALS = JSON.parse(process.env.BIGQUERY_CREDENTIALS);

