import parseCMCDQueryToJson from './parseCMCDQueryToJson.js';
import saveBigQuery from './bigquery.js';
import savePubSub from './pubsub.js';
import saveFluentd from './fluentd.js';


export const cmcdExtractorService = async ({req, cmcdMode}) => {
    const contentType = req.headers['content-type'];

    // Ensure that for JSON content type, req.body is an object (which includes arrays)
    if (contentType === 'application/json' && req.body && typeof req.body === 'object') {
        const cmcdDataArray = Array.isArray(req.body) ? req.body : [req.body];

        for (const cmcd_keys of cmcdDataArray) {
            const body = {};
            body['request_user_agent'] = req.headers['user-agent'];
            body['request_origin'] = req.headers.origin;
            body['request_ip'] = req.ip;
            body['request_datetime'] = new Date().toISOString();
            body['cmcd_mode'] = cmcdMode;

            Object.keys(cmcd_keys).forEach(key => {
                body[`cmcd_key_${key}`] = cmcd_keys[key];
                if (key === "ts"){
                    body[`cmcd_key_ts_date`] = new Date(cmcd_keys[key]).toISOString();
                }
            });
            body['cmcd_data'] = JSON.stringify(cmcd_keys);
            saveData(body);
        }
    } else {
        const rawData = req?.query['CMCD'];
        if (rawData) {
            const body = {};
            const cmcd_keys = parseCMCDQueryToJson(rawData);
            body['request_user_agent'] = req.headers['user-agent'];
            body['request_origin'] = req.headers.origin;
            body['request_ip'] = req.ip;
            body['request_datetime'] = new Date().toISOString();
            body['cmcd_mode'] = cmcdMode;
            Object.keys(cmcd_keys).forEach(key => {
                body[`cmcd_key_${key}`] = cmcd_keys[key];
                if (key === "ts"){
                    body[`cmcd_key_ts_date`] = new Date(cmcd_keys[key]).toISOString();
                }
            });
            body['cmcd_data'] = rawData;
            saveData(body);
        }
    }
}

const saveData = async (body) => {
    // TODO: Save data
    console.log (body);
    saveFluentd(body);
    saveBigQuery(body);
    savePubSub(body);
}
