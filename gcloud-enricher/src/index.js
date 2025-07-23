import { PubSub } from '@google-cloud/pubsub';
import { Storage } from '@google-cloud/storage';
import maxmind from 'maxmind';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import functions from '@google-cloud/functions-framework';

config();
config({ path: `.env.local`, override: true });

const PUBSUB_OUTPUT_TOPIC_NAME = process.env.PUBSUB_OUTPUT_TOPIC_NAME;
const BUCKET_NAME = process.env.BUCKET_NAME;
const BUCKET_DB_FILE = process.env.BUCKET_DB_FILE;

const pubsub = new PubSub();
const storage = new Storage();
const geoIpDbPath = path.join('/tmp', BUCKET_DB_FILE);

let reader;

async function downloadGeoIpDatabase() {
    if (reader) {
        return;
    }
    try {
        console.log(`Downloading GeoIP database from gs://${BUCKET_NAME}/${BUCKET_DB_FILE}...`);
        await storage.bucket(BUCKET_NAME).file(BUCKET_DB_FILE).download({ destination: geoIpDbPath });
        console.log('GeoIP database downloaded successfully.');
        reader = await maxmind.open(geoIpDbPath);
        console.log('GeoIP database loaded successfully.');
    } catch (error) {
        console.error('Failed to download or load GeoIP database:', error);
        throw error;
    }
}

functions.cloudEvent('enrichCmcd', async (cloudEvent) => {
    await downloadGeoIpDatabase();

    const payload = Buffer.from(cloudEvent.data.message.data, 'base64').toString('utf-8');

    let data;
    try {
        data = JSON.parse(payload);
    } catch (error) {
        console.error('Failed to parse Pub/Sub message:', error);
        return; // Acknowledge to prevent retries
    }

    const ip = data.request_ip;
    if (!ip) {
        console.warn('No request_ip found in the message.');
    } else {
        const geoData = reader.get(ip);
        if (geoData) {
            data.request_country_code = geoData.country?.iso_code;
            data.request_country_name = geoData.country?.names?.en;
            data.request_city_name = geoData.city?.names?.en;
            data.request_postal_code = geoData.postal?.code;
            data.request_latitude = geoData.location?.latitude;
            data.request_longitude = geoData.location?.longitude;
            data.request_asn_number = geoData.autonomous_system_number;
            data.request_asn_organization = geoData.autonomous_system_organization;
        } else {
            console.warn(`IP address ${ip} not found in GeoIP database.`);
        }
    }

    try {
        const messageBuffer = Buffer.from(JSON.stringify(data));
        await pubsub.topic(PUBSUB_OUTPUT_TOPIC_NAME).publishMessage({ data: messageBuffer });
        console.log('Enriched message published successfully.');
    } catch (error) {
        console.error('Failed to publish enriched message:', error);
        // Let the function fail to trigger a retry
        throw error;
    }
});
