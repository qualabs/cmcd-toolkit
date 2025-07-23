import functions from '@google-cloud/functions-framework';
import { PubSub } from '@google-cloud/pubsub';
import { Storage } from '@google-cloud/storage';
import maxmind from 'maxmind';
import path from 'path';

const PUBSUB_OUTPUT_TOPIC_NAME = process.env.PUBSUB_OUTPUT_TOPIC_NAME;
const BUCKET_NAME = process.env.BUCKET_NAME;
const GEOLITE2_CITY_FILE = process.env.GEOLITE2_CITY_FILE;
const GEOLITE2_ASN_FILE = process.env.GEOLITE2_ASN_FILE;


const pubsub = new PubSub();
const storage = new Storage();
const geolite2CityPath = path.join('/tmp', GEOLITE2_CITY_FILE);
const geolite2AsnPath = path.join('/tmp', GEOLITE2_ASN_FILE);

let geolite2city;
let geolite2asn;
let initializationPromise = null;

async function downloadAndLoadGeoIpDatabase() {
    if (GEOLITE2_CITY_FILE){
        try {
            console.log(`Downloading GeoLite2-City database from gs://${BUCKET_NAME}/${GEOLITE2_CITY_FILE}...`);
            await storage.bucket(BUCKET_NAME).file(GEOLITE2_CITY_FILE).download({ destination: geolite2CityPath });
            console.log('GeoLite2-City database downloaded successfully.');
            geolite2city = await maxmind.open(geolite2CityPath);
            console.log('GeoLite2-City database loaded successfully.');
        } catch (error) {
            console.error('Failed to download or load GeoLite2-City database:', error);
            initializationPromise = null;
            throw error;
        }
    }

    if (GEOLITE2_ASN_FILE) {
        try{
            console.log(`Downloading GeoLite2-ASN database from gs://${BUCKET_NAME}/${GEOLITE2_ASN_FILE}...`);
            await storage.bucket(BUCKET_NAME).file(GEOLITE2_ASN_FILE).download({ destination: geolite2AsnPath });
            console.log('GeoLite2-ASN database downloaded successfully.');
            geolite2asn = await maxmind.open(geolite2AsnPath);
            console.log('GeoLite2-ASN database loaded successfully.');
        } catch (error) {
            console.error('Failed to download or load GeoLite2-ASN database:', error);
            initializationPromise = null;
            throw error;
        }
    }
}

function getInitializationPromise() {
    // At startup, download the db only once.
    if (!initializationPromise) {
        console.log('GeoIP database not initialized. Starting download.');
        initializationPromise = downloadAndLoadGeoIpDatabase();
    }
    return initializationPromise;
}

functions.cloudEvent('enrichCmcd', async (cloudEvent) => {
    try {
        await getInitializationPromise();
    } catch (error) {
        console.error('GeoIP database initialization failed. Aborting function execution.');
        throw error;
    }

    const payload = Buffer.from(cloudEvent.data.message.data, 'base64').toString('utf-8');

    let data;
    try {
        data = JSON.parse(payload);
    } catch (error) {
        console.error('Failed to parse Pub/Sub message:', error);
        return; // Acknowledge to prevent retries
    }

    if (geolite2city) {
        const geoCityData = geolite2city.get(data.request_ip);
        if (geoCityData) {
            data.request_country_code = geoCityData.country?.iso_code;
            data.request_country_name = geoCityData.country?.names?.en;
            data.request_city_name = geoCityData.city?.names?.en;
            data.request_postal_code = geoCityData.postal?.code;
            data.request_latitude = geoCityData.location?.latitude;
            data.request_longitude = geoCityData.location?.longitude;
        } else {
            console.warn(`IP address ${data.request_ip} not found in GeoLite2-City database.`);
        }
    }

    if (geolite2asn) {
        const geoAsnData = geolite2asn.get(data.request_ip);
        if (geoAsnData) {
            data.request_asn_number = geoAsnData.autonomous_system_number;
            data.request_asn_organization = geoAsnData.autonomous_system_organization;
        } else {
            console.warn(`IP address ${data.request_ip} not found in GeoLite2-ASN database.`);
        }
    }

    try {
        const messageBuffer = Buffer.from(JSON.stringify(data));
        await pubsub.topic(PUBSUB_OUTPUT_TOPIC_NAME).publishMessage({ data: messageBuffer });
    } catch (error) {
        console.error('Failed to publish enriched message:', error);
        // Let the function fail to trigger a retry
        throw error;
    }
});
