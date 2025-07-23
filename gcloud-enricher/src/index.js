import functions from '@google-cloud/functions-framework';
import { PubSub } from '@google-cloud/pubsub';
import { Storage } from '@google-cloud/storage';
import maxmind from 'maxmind';
import { UAParser } from 'ua-parser-js';
import path from 'path';

const PUBSUB_OUTPUT_TOPIC_NAME = process.env.PUBSUB_OUTPUT_TOPIC_NAME; //Required. Name of the Pub/Sub topic to publish enriched messages
const BUCKET_NAME = process.env.BUCKET_NAME; // Optional, can be empty if not used. Name of the bucket where the GeoLite2 databases are stored
const GEOLITE2_CITY_FILE = process.env.GEOLITE2_CITY_FILE; // Optional, can be empty if not used. Name of the GeoLite2 City database file in the bucket
const GEOLITE2_ASN_FILE = process.env.GEOLITE2_ASN_FILE; // Optional, can be empty if not used. Name of the GeoLite2 ASN database file in the bucket
const FILTER_DATA = process.env.FILTER_DATA; // Optional, can be empty if not used. Coma separated list of fields to remmove before publishing
const PARSE_USER_AGENT = process.env.PARSE_USER_AGENT === 'true'; // Optional, can be 'true' or 'false'. If true, user agent will be parsed and added to the data

const pubsub = new PubSub();
const storage = new Storage();

let geolite2city = null;
let geolite2asn = null;
let initializationPromise = null;

async function downloadAndLoadGeoIpDatabase() {
    if (!BUCKET_NAME) {
        console.log(`No bucket name provided.`);
        return
    }

    if (GEOLITE2_CITY_FILE){
        try {
            console.log(`Downloading GeoLite2-City database from gs://${BUCKET_NAME}/${GEOLITE2_CITY_FILE}...`);
            const geolite2CityPath = path.join('/tmp', GEOLITE2_CITY_FILE);
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
            const geolite2AsnPath = path.join('/tmp', GEOLITE2_ASN_FILE);
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
        console.log('GeoIP databases not initialized. Starting download.');
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
            if (geoCityData.country?.iso_code) data.request_country_code = geoCityData.country?.iso_code;
            if (geoCityData.country?.names?.en) data.request_country_name = geoCityData.country?.names?.en;
            if (geoCityData.city?.names?.en) data.request_city_name = geoCityData.city?.names?.en;
            if (geoCityData.postal?.code) data.request_postal_code = geoCityData.postal?.code;
            if (geoCityData.location?.latitude) data.request_latitude = geoCityData.location?.latitude;
            if (geoCityData.location?.longitude) data.request_longitude = geoCityData.location?.longitude;
        } else {
            console.warn(`IP address ${data.request_ip} not found in GeoLite2-City database.`);
        }
    }

    if (geolite2asn) {
        const geoAsnData = geolite2asn.get(data.request_ip);
        if (geoAsnData) {
            if (geoAsnData.autonomous_system_number) data.request_asn_number = geoAsnData.autonomous_system_number;
            if (geoAsnData.autonomous_system_organization) data.request_asn_organization = geoAsnData.autonomous_system_organization;
        } else {
            console.warn(`IP address ${data.request_ip} not found in GeoLite2-ASN database.`);
        }
    }

    if (PARSE_USER_AGENT && data.request_user_agent) {
        const uaData = UAParser(data.request_user_agent);
        if(uaData.browser.name) data.request_browser_name = uaData.browser.name;
        if(uaData.browser.version) data.request_browser_version = uaData.browser.version;
        if(uaData.browser.major) data.request_browser_major = uaData.browser.major;
        if(uaData.browser.type) data.request_browser_type = uaData.browser.type; // 'browser', 'bot', 'unknown', etc.
        if(uaData.cpu.architecture) data.request_cpu_architecture = uaData.cpu.architecture;
        if(uaData.device.vendor) data.request_device_vendor = uaData.device.vendor;
        if(uaData.device.model) data.request_device_model = uaData.device.model;
        if(uaData.device.type) data.request_device_type = uaData.device.type; // 'mobile', 'tablet', 'desktop', etc.
        if(uaData.engine.name) data.request_engine_name = uaData.engine.name;
        if(uaData.engine.version) data.request_engine_version = uaData.engine.version;
        if(uaData.os.name) data.request_os_name = uaData.os.name;
        if(uaData.os.version) data.request_os_version = uaData.os.version;
    }

    if (FILTER_DATA) {
        // Remove fields specified in FILTER_DATA
        const fieldsToRemove = FILTER_DATA.split(',').map(field => field.trim());
        fieldsToRemove.forEach(field => {
            if (data.hasOwnProperty(field)) {
                delete data[field];
            }
        });    
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
