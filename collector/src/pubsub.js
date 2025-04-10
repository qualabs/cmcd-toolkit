import fs from 'fs';
import { PubSub } from '@google-cloud/pubsub';
import {PUBSUB_ENABLED, PUBSUB_TOPIC_NAME, PUBSUB_USE_SCHEMA } from './utils/config.js';

const schemaRaw = fs.readFileSync('./pub-sub-schema.json', 'utf8');
const pubSubSchema = JSON.parse(schemaRaw);
const pubsub = new PubSub();

const saveData = async (body) => {
    if (PUBSUB_ENABLED){
        try {
            const pubsubMessage = PUBSUB_USE_SCHEMA ? transformDataForPubSub(body, pubSubSchema) : body 
            const messageBuffer = Buffer.from(JSON.stringify(pubsubMessage));
            const messageId = await pubsub.topic(PUBSUB_TOPIC_NAME).publishMessage({data: messageBuffer});
            console.log(`Message ${messageId} published to ${PUBSUB_TOPIC_NAME}.`);
        } catch (error) {
            console.error(`Received error while publishing: ${error.message}`);
        }
    }
}

/**
 * Transforms a CMCD data object according to the Pub/Sub Avro schema.
 * - Adds missing fields from the schema with a null value.
 * - Wraps existing values in an object with their primary Avro type.
 *
 * @param {object} inputObject The input object with CMCD data.
 * @param {object} schema The Pub/Sub Avro schema object.
 * @returns {object} The transformed object.
 */
function transformDataForPubSub(inputObject, schema) {
    if (!inputObject || typeof inputObject !== 'object') {
        console.error("Input must be a valid object.");
        return {};
    }
    if (!schema || !Array.isArray(schema.fields)) {
        console.error("Invalid schema or it does not contain 'fields'.");
        return {};
    }

    const outputObject = {};
    const schemaFields = schema.fields;

    // Iterate over each field defined in the schema
    for (const field of schemaFields) {
        const fieldName = field.name;
        const fieldTypes = field.type; // It's an array like ["null", "string"]

        // Check if the key exists in the input object
        if (inputObject.hasOwnProperty(fieldName)) {
            const inputValue = inputObject[fieldName];

            // Find the primary type (not 'null') from the types array
            const primaryType = fieldTypes.find(t => t !== 'null');

            if (primaryType) {
                // Create the object { "type": value }
                outputObject[fieldName] = { [primaryType]: inputValue };
            } else {
                // Unlikely case if the schema doesn't follow the ["null", type] pattern
                console.warn(`Could not determine the primary type for field: ${fieldName}`);
                // You could assign null or handle it differently
                outputObject[fieldName] = null;
            }
        } else {
            // If the schema key is not in the input object, add it with a null value
            outputObject[fieldName] = null;
        }
    }

    // Note: Keys in inputObject that are NOT in schema.fields will be ignored.
    return outputObject;
}

export default saveData; 