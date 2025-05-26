import { FluentClient } from "@fluent-org/logger"
import { LOCAL_ENABLED, LOCAL_FLUENTD_HOST, LOCAL_FLUENTD_PORT, LOCAL_FLUENTD_TAG } from './utils/config.js';

const logger = new FluentClient(LOCAL_FLUENTD_TAG, {
  socket: {
    host: LOCAL_FLUENTD_HOST,
    port: LOCAL_FLUENTD_PORT,
    timeout: 3000, // 3 seconds
  }
});

const saveData = async (body) => {
    if (LOCAL_ENABLED){
        try {
            logger.emit(body);
            console.log(`Message published to ${LOCAL_FLUENTD_TAG}.`);
        } catch (error) {
            console.error(`Received error while publishing: ${error.message}`);
        }
    }
}

export default saveData; 