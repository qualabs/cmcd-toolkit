import { PubSub } from '@google-cloud/pubsub';
import {PUBSUB_ENABLED, PUBSUB_TOPIC_NAME } from './utils/config.js';

const pubsub = new PubSub();

const saveData = async (body) => {
    if (PUBSUB_ENABLED){
        try {
            const messageBuffer = Buffer.from(JSON.stringify(body));
            const messageId = await pubsub.topic(PUBSUB_TOPIC_NAME).publishMessage({data: messageBuffer});
            console.log(`Message ${messageId} published to ${PUBSUB_TOPIC_NAME}.`);
        } catch (error) {
            console.error(`Received error while publishing: ${error.message}`);
        }
    }
}

export default saveData; 