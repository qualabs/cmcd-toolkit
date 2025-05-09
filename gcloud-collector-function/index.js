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
    const cmcdMode = getCMCDMode(req, res)

    // TODO: Implement headers and JSON mode, only queryparams are allowed 
    const rawData = req.query['CMCD'];
    if (!rawData) {
        console.warn('CMCD query parameter is missing. Only queryparams are supported');
        return res.status(400).send('Bad Request: CMCD query parameter is missing. Only queryparams are supported');
    }

    try {
        // 1. Parse CMCD
        const cmcd_keys = parseCMCDQueryToJson(rawData);

        if (Object.keys(cmcd_keys).length === 0) {
             console.warn('Parsed CMCD data is empty.');
             // Decide si esto es un error o no. Podría ser un 204 igual.
             return res.status(400).send('Bad Request: Parsed CMCD data is empty.');
        }

        // 2. Build the body object
        const body = {};
        body['request_user_agent'] = req.headers['user-agent'] || null;
        body['request_origin'] = req.headers['origin'] || null;
        // req.ip is managed by Functions Framework (may need  config of trust proxy in LB)
        body['request_ip'] = req.ip || null;
        body['request_datetime'] = new Date().toISOString();
        body['cmcd_mode'] = cmcdMode;

        Object.keys(cmcd_keys).forEach(key => {
            body[`cmcd_key_${key}`] = cmcd_keys[key];
            // Pasrse 'ts'
            if (key === "ts" && typeof cmcd_keys[key] === 'number') {
                try {
                    body[`cmcd_key_ts_date`] = new Date(cmcd_keys[key]).toISOString();
                } catch (dateError) {
                     console.warn(`Could not convert cmcd_key_ts (${cmcd_keys[key]}) to Date: ${dateError.message}`);
                }
            }
        });
        body['cmcd_data'] = rawData; // Save the original data

        // 3. Prepare and send to  Pub/Sub
        const messageBuffer = Buffer.from(JSON.stringify(body));
        const messageId = await pubsub.topic(PUBSUB_TOPIC_NAME).publishMessage({ data: messageBuffer });
        console.log(`Message ${messageId} published to ${PUBSUB_TOPIC_NAME}.`);

        // 4. Enviar respuesta HTTP
        res.status(204).send(); // 204 No Content es apropiado para colectores

    } catch (error) {
        console.error(`Error processing request or publishing to Pub/Sub: ${error.message}`, error);
        res.status(500).send('Internal Server Error');
    }
});
