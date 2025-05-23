import parseCMCDQueryToJson from './parseCMCDQueryToJson.js';
import saveBigQuery from './bigquery.js';
import savePubSub from './pubsub.js';
import saveFluentd from './fluentd.js';
import { request } from 'http';


export const cmcdExtractorService = async ({req, cmcdMode}) => {
    const contentType = req.headers['content-type'];
    // Ensure that for JSON content type, req.body is an object (which includes arrays)
    if (contentType === 'application/json' && req.body && typeof req.body === 'object') {
        const cmcdDataArray = Array.isArray(req.body) ? req.body : [req.body];

        cmcdDataArray.forEach(cmcd_keys => {
            processCMCDRegistry(req, cmcdMode, cmcd_keys);
        });
    } else {
        const rawData = req?.query['CMCD'];
        if (rawData) {
            const cmcd_keys = parseCMCDQueryToJson(rawData);
            processCMCDRegistry(req, cmcdMode, cmcd_keys, rawData);
        }
    }
}

const processCMCDRegistry = (req, cmcdMode, cmcd_keys, rawData) => {
    const body = {
        request_user_agent: req.headers['user-agent'],
        request_origin: req.headers.origin,
        request_ip: req.ip,
        request_datetime: new Date().toISOString(),
        cmcd_mode: cmcdMode,
        cmcd_data: rawData || JSON.stringify(cmcd_keys)
    };
    Object.keys(cmcd_keys).forEach(key => {
        body[`cmcd_key_${key}`] = cmcd_keys[key];
        if (key === "ts"){
            body.cmcd_key_ts_date = new Date(cmcd_keys[key]).toISOString();
        }
    });
    saveData(body);
}

const saveData = async (body) => {
    console.log (body);
    saveFluentd(body);
    saveBigQuery(body);
    savePubSub(body);
}
