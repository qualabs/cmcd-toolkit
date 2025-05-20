import functions from '@google-cloud/functions-framework';
import { PubSub } from '@google-cloud/pubsub';

const PUBSUB_TOPIC_NAME = process.env.PUBSUB_TOPIC_NAME || 'cmcd';

if (!PUBSUB_TOPIC_NAME) {
    console.error('FATAL ERROR: PUBSUB_TOPIC_NAME environment variable not set.');
    throw new Error('PUBSUB_TOPIC_NAME environment variable not set.');
}

const ALLOWED_ORIGINS = '*'; 
const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ALLOWED_HEADERS = '*'; 

const pubsub = new PubSub();

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

    console.log(`Received request for path: ${requestPath}`);

    // Verify if the path starts with /cmcd/response-mode o /cmcd/event-mode
    if (requestPath.startsWith('/cmcd/response-mode')) {
        cmcdMode = 'response';
    } else if (requestPath.startsWith('/cmcd/event-mode')) {
        cmcdMode = 'event';
    } else {
        // Return error
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

            for (const cmcd_item of cmcdDataArray) {
                if (Object.keys(cmcd_item).length === 0) {
                    console.warn('Encountered an empty CMCD object in the JSON array.');
                    // Potentially skip this item or return an error for the whole request
                    // For now, we'll skip it and continue processing others.
                    continue; 
                }

                const dataToPublish = {};
                dataToPublish['request_user_agent'] = req.headers['user-agent'] || null;
                dataToPublish['request_origin'] = req.headers['origin'] || null;
                dataToPublish['request_ip'] = req.ip || null;
                dataToPublish['request_datetime'] = new Date().toISOString();
                dataToPublish['cmcd_mode'] = cmcdMode;

                Object.keys(cmcd_item).forEach(key => {
                    dataToPublish[`cmcd_key_${key}`] = cmcd_item[key];
                    if (key === "ts" && typeof cmcd_item[key] === 'number') {
                        try {
                            dataToPublish[`cmcd_key_ts_date`] = new Date(cmcd_item[key]).toISOString();
                        } catch (dateError) {
                            console.warn(`Could not convert cmcd_key_ts (${cmcd_item[key]}) to Date: ${dateError.message}`);
                        }
                    }
                });
                dataToPublish['cmcd_data'] = JSON.stringify(cmcd_item);

                const messageBuffer = Buffer.from(JSON.stringify(dataToPublish));
                const messageId = await pubsub.topic(PUBSUB_TOPIC_NAME).publishMessage({ data: messageBuffer });
                console.log(`Message ${messageId} (JSON item) published to ${PUBSUB_TOPIC_NAME}.`);
            }
            res.status(204).send();

        } else {
            // Query Parameter Handling (Existing Logic)
            const rawData = req.query['CMCD'];
            if (!rawData) {
                console.warn('CMCD data not found in query parameters or JSON payload.');
                return res.status(400).send('Bad Request: CMCD data not found in query parameters or JSON payload.');
            }

            const cmcd_keys = parseCMCDQueryToJson(rawData);

            if (Object.keys(cmcd_keys).length === 0) {
                console.warn('Parsed CMCD data from query is empty.');
                return res.status(400).send('Bad Request: Parsed CMCD data from query is empty.');
            }

            const dataToPublish = {};
            dataToPublish['request_user_agent'] = req.headers['user-agent'] || null;
            dataToPublish['request_origin'] = req.headers['origin'] || null;
            dataToPublish['request_ip'] = req.ip || null;
            dataToPublish['request_datetime'] = new Date().toISOString();
            dataToPublish['cmcd_mode'] = cmcdMode;

            Object.keys(cmcd_keys).forEach(key => {
                dataToPublish[`cmcd_key_${key}`] = cmcd_keys[key];
                if (key === "ts" && typeof cmcd_keys[key] === 'number') {
                    try {
                        dataToPublish[`cmcd_key_ts_date`] = new Date(cmcd_keys[key]).toISOString();
                    } catch (dateError) {
                        console.warn(`Could not convert cmcd_key_ts (${cmcd_keys[key]}) to Date: ${dateError.message}`);
                    }
                }
            });
            dataToPublish['cmcd_data'] = rawData;

            const messageBuffer = Buffer.from(JSON.stringify(dataToPublish));
            const messageId = await pubsub.topic(PUBSUB_TOPIC_NAME).publishMessage({ data: messageBuffer });
            console.log(`Message ${messageId} (query param) published to ${PUBSUB_TOPIC_NAME}.`);
            
            res.status(204).send();
        }

    } catch (error) {
        console.error(`Error processing request or publishing to Pub/Sub: ${error.message}`, error);
        res.status(500).send('Internal Server Error');
    }
});
