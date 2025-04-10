import parseCMCDQueryToJson from './parseCMCDQueryToJson.js';
import saveBigQuery from './bigquery.js';
import savePubSub from './pubsub.js';

export const cmcdExtractorService = async ({req, cmcdMode}) => {
    const body = {};
    const rawData = req?.query['CMCD']

    if(rawData){
        const cmcd_keys = parseCMCDQueryToJson(req?.query['CMCD'])
        body['request_user_agent'] = req.headers['user-agent'];
        body['request_origin'] = req.headers.origin;
        body['request_ip'] = req.ip;
        body['request_datetime'] = new Date().toISOString();
        body['cmcd_mode'] = cmcdMode;
        Object.keys(cmcd_keys).forEach(key => {
            body[`cmcd_key_${key}`] = cmcd_keys[key];
            if (key == "ts"){
                body[`cmcd_key_ts_date`] = new Date(cmcd_keys[key]).toISOString();
            }
        });
        body['cmcd_data'] = rawData;
        saveData(body);
    }
}

const saveData = async (body) => {
    // TODO: Save data
    console.log (body);
    saveBigQuery(body);
    savePubSub(body);
}
