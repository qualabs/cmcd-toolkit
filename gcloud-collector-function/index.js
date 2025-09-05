import functions from '@google-cloud/functions-framework';
import { PubSub } from '@google-cloud/pubsub';

// --- Global Constants and Client Initialization ---
const PUBSUB_TOPIC_NAME = process.env.PUBSUB_TOPIC_NAME || 'cmcd';

if (!PUBSUB_TOPIC_NAME) {
    console.error('FATAL ERROR: PUBSUB_TOPIC_NAME environment variable not set.');
    throw new new Error('PUBSUB_TOPIC_NAME environment variable not set.');
}

const ALLOWED_ORIGINS = '*'; 
const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ALLOWED_HEADERS = '*'; 

// Initialize PubSub client globally to reuse it across warm invocations
// The PubSub client inherently handles batching.
const pubsub = new PubSub();
const pubsubTopic = pubsub.topic(PUBSUB_TOPIC_NAME); // Get topic reference once

const parseCMCDQueryToJson = (input) => {
    if (!input) return {};
    const regex = /([a-zA-Z0-9_]+)=("[^"]*"|[^,]*)(?=,|$)|([a-zA-Z0-9_]+)(?=,|$)/g;
    const result = {};
    let match;

    while ((match = regex.exec(input)) !== null) {
        const key = match[1] || match[3]; // Match key with or without value
        let value = match[2];

        if (value === undefined) { // Key without value is boolean true
            result[key] = true;
        } else {
            if (value.startsWith('"') && value.endsWith('"')) { // Remove quotes
                value = value.slice(1, -1);
            }
            if (/^-?\d+$/.test(value)) { // Integer
                result[key] = parseInt(value, 10);
            } else if (/^-?\d*\.\d+$/.test(value)) { // Float
                result[key] = parseFloat(value);
            } else if (value.toLowerCase() === "true" || value.toLowerCase() === "false") { // Boolean
                result[key] = value.toLowerCase() === "true";
            } else { // String
                result[key] = value;
            }
        }
    }
    return result;
};

const getCMCDMode = (req, res) => {
    let cmcdMode;
    const requestPath = req.path;

    if (requestPath.startsWith('/cmcd/response-mode')) {
        cmcdMode = 'response';
    } else if (requestPath.startsWith('/cmcd/event-mode')) {
        cmcdMode = 'event';
    } else {
        console.warn(`Unsupported path: ${requestPath}`);
        return res.status(404).send('Not Found: Please use /cmcd/response-mode or /cmcd/event-mode path.');
    }
    return cmcdMode;
}

const CORS = (req, res) => {
    res.set('Access-Control-Allow-Origin', ALLOWED_ORIGINS);
    res.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
    }   
}

/**
 * Processes a single CMCD data object, enriches it with request metadata,
 * and publishes it to Pub/Sub.
 * @param {object} req - The Express request object.
 * @param {string} cmcdMode - The mode ('event' or 'response').
 * @param {object} cmcdKeys - The parsed CMCD key-value pairs.
 * @param {string} rawData - The original raw CMCD data string.
 * @returns {Promise<string|null>} A promise that resolves with the message ID on success or null on failure.
 */
const processAndPublishCmcd = (req, cmcdMode, cmcdKeys, rawData) => {
    const dataToPublish = {
        request_user_agent: req.headers['user-agent'] || null,
        request_origin: req.headers['origin'] || null,
        request_ip: req.ip || null,
        request_datetime: new Date().toISOString(),
        cmcd_mode: cmcdMode,
        cmcd_data: rawData,
    };

    Object.keys(cmcdKeys).forEach(key => {
        dataToPublish[`cmcd_key_${key}`] = cmcdKeys[key];
        if (key === "ts" && typeof cmcdKeys[key] === 'number') {
            try {
                dataToPublish[`cmcd_key_ts_date`] = new Date(cmcdKeys[key]).toISOString();
            } catch (dateError) {
                console.warn(`Could not convert cmcd_key_ts (${cmcdKeys[key]}) to Date: ${dateError.message}`);
            }
        }
        if (key === "url") {
            try {
                const url = new URL(cmcdKeys[key]);
                dataToPublish['cmcd_key_url_domain'] = url.hostname;
            } catch (urlError) {
                console.warn(`Could not parse URL for cmcd_key_url: ${cmcdKeys[key]}`);
                dataToPublish['cmcd_key_url_domain'] = null;
            }
        }
    });

    const messageBuffer = Buffer.from(JSON.stringify(dataToPublish));
    
    return pubsubTopic.publishMessage({ data: messageBuffer })
        .catch(err => {
            console.error(`Failed to publish a message: ${err.message}. Data: ${JSON.stringify(dataToPublish)}`);
            return null;
        });
};

// --- Main HTTP Function ---
functions.http('cmcdProcessor', async (req, res) => {
    // Set CORS
    CORS(req, res);
    
    // Only GET o POST methods are allowed 
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    // Get the mode
    const cmcdMode = getCMCDMode(req, res);
    if (res.headersSent) return; // Stop processing if getCMCDMode sent a response

    const contentType = req.headers['content-type'];
    const publishPromises = []; // Array to collect all Pub/Sub publish promises
    let messagesProcessed = 0; // Counter for logging purposes

    try {
        if (contentType && contentType.startsWith('application/json')) {
            // JSON Payload Handling
            if (typeof req.body !== 'object' || req.body === null) {
                console.warn('CMCD JSON payload is not an object or is null. Received:', typeof req.body);
                return res.status(400).send('Bad Request: CMCD JSON payload must be a JSON object or array.');
            }

            // Check for empty object or empty array
            if ((Array.isArray(req.body) && req.body.length === 0) || Object.keys(req.body).length === 0) {
                console.warn('CMCD JSON payload is an empty object or array.');
                return res.status(400).send('Bad Request: CMCD JSON payload is an empty object or array.');
            }

            const cmcdDataArray = Array.isArray(req.body) ? req.body : [req.body];

            for (const cmcdDataItem of cmcdDataArray) {
                if (Object.keys(cmcdDataItem).length === 0) {
                    console.warn('Encountered an empty CMCD object in the JSON array.');
                    // Potentially skip this item or return an error for the whole request
                    // For now, we'll skip it and continue processing others.
                    continue; 
                }

                publishPromises.push(processAndPublishCmcd(req, cmcdMode, cmcdDataItem, JSON.stringify(cmcdDataItem)));
                messagesProcessed++;
            }
        } else if (contentType && (contentType.startsWith('application/cmcd+text')) || contentType.startsWith('text/cmcd')) {
            // Plain Text Handling
            const cmcdDataArray = req.body.toString('utf8').split('\n');

            for (const cmcdDataItem of cmcdDataArray) {
                const cmcdData = parseCMCDQueryToJson(decodeURIComponent(cmcdDataItem));
                if (Object.keys(cmcdData).length === 0) {
                    console.warn('Encountered an empty CMCD object in the JSON array.');
                    // Potentially skip this item or return an error for the whole request
                    // For now, we'll skip it and continue processing others.
                    continue; 
                }
                publishPromises.push(processAndPublishCmcd(req, cmcdMode, cmcdData, cmcdDataItem));
                messagesProcessed++;
            }
            
        } else {
            // Query Parameter Handling (Existing Logic)
            const rawData = req.query['CMCD'];
            if (!rawData) {
                console.warn('CMCD data not found in query parameters or JSON payload.');
                return res.status(400).send('Bad Request: CMCD data not found in query parameters or JSON payload.');
            }

            const cmcdData = parseCMCDQueryToJson(rawData);

            if (Object.keys(cmcdData).length === 0) {
                console.warn('Parsed CMCD data from query is empty.');
                return res.status(400).send('Bad Request: Parsed CMCD data from query is empty.');
            }

            publishPromises.push(processAndPublishCmcd(req, cmcdMode, cmcdData, rawData));
            messagesProcessed++;
        }

        // --- Critical Step: Wait for all publish operations to complete ---
        // Use Promise.allSettled to ensure that even if some publishes fail,
        // the function waits for all to attempt completion and logs the results.
        const results = await Promise.allSettled(publishPromises);
        
        let successfulPublishes = 0;
        let failedPublishes = 0;

        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value !== null) { // result.value is null for caught errors
                successfulPublishes++;
            } else {
                failedPublishes++;
            }
        });

        console.log(`Summary: Attempted to publish ${messagesProcessed} messages. Successful: ${successfulPublishes}, Failed: ${failedPublishes}.`);

        // If any message failed, you might want to return a 500, or a 200 with warnings.
        // For data ingestion, 204 (No Content) is often appropriate if the request was syntactically correct.
        // If all failed, or critical messages failed, a 500 might be better.
        // For now, if at least one message was processed successfully, return 204.

        if (messagesProcessed == 0){
            res.status(204).send();
        } else if (successfulPublishes > 0) {
            res.status(204).send();
        } else {
            console.error('No messages were successfully published.');
            res.status(500).send('Internal Server Error: No messages were published.');
        }

    } catch (error) {
        console.error(`Unhandled error processing request: ${error.message}`, error);
        res.status(500).send('Internal Server Error');
    }
});