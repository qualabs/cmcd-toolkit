import { BigQuery } from '@google-cloud/bigquery';
import {BIGQUERY_ENABLED, BIGQUERY_CREDENTIALS, BIGQUERY_DATASET, BIGQUERY_TABLE } from './utils/config.js';

const bigquery = new BigQuery({credentials:BIGQUERY_CREDENTIALS});

const saveData = async (body) => {
    if (BIGQUERY_ENABLED){
        try {
            // Insert data into BigQuery
            await bigquery.dataset(BIGQUERY_DATASET).table(BIGQUERY_TABLE).insert([body]);
            console.log(`Inserted data into ${BIGQUERY_DATASET}.${BIGQUERY_TABLE}`);
        } catch (error) {
            console.error('Error inserting data into BigQuery:', error);
        }    
    }
}

export default saveData; 