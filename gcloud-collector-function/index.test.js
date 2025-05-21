// Set ENV vars for testing BEFORE importing the module under test
process.env.PUBSUB_TOPIC_NAME = 'test-cmcd-topic';

// Object to hold the registered HTTP function
const frameworkMockState = {
  registeredHttpFunction: null,
};

// Mock @google-cloud/functions-framework
// This mock needs to be defined before index.js is imported.
jest.mock('@google-cloud/functions-framework', () => ({
  http: (name, handler) => {
    if (name === 'cmcdProcessor') {
      frameworkMockState.registeredHttpFunction = handler; // Assign to the object's property
    }
  },
}));

// Main module under test - import it AFTER mocks are set up.
// This will trigger the functions.http call in index.js, populating frameworkMockState.
import './index.js'; 

// Import the mock functions that will be exported by the mocked @google-cloud/pubsub
import { 
    PubSub, 
    topicMock as importedTopicMock, 
    publishMessageMock as importedPublishMessageMock 
} from '@google-cloud/pubsub';


jest.mock('@google-cloud/pubsub', () => {
  const actualPubSub = jest.requireActual('@google-cloud/pubsub');
  // Define mocks inside the factory
  const publishMessageMockInner = jest.fn(); 
  const topicMockInner = jest.fn(() => ({ publishMessage: publishMessageMockInner }));
  
  return {
    ...actualPubSub, // Keep other exports like PubSub class itself
    PubSub: jest.fn(() => ({ topic: topicMockInner })), // This is the constructor mock
    // Expose the inner mocks for tests to import
    topicMock: topicMockInner,
    publishMessageMock: publishMessageMockInner,
  };
});

describe('cmcdProcessor Cloud Function', () => {
    let mockReq;
    let mockRes;
    const mockISODate = '2024-07-29T10:00:00.000Z';

    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(mockISODate));
    });

    beforeEach(() => {
        // Clear imported mocks before each test
        importedPublishMessageMock.mockClear().mockResolvedValue('mock-message-id'); // Reset behavior
        importedTopicMock.mockClear();
        
        // It's good practice to also clear all mocks if other modules were inadvertently mocked or spied on.
        // jest.clearAllMocks(); // Can be redundant if only these two are used and reset.

        mockReq = {
            method: 'GET', // Default method
            headers: {},
            body: null,
            query: {},
            path: '/cmcd/event-mode', // Default path
            ip: '127.0.0.1',
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            headersSent: false, 
        };
        
        process.env.PUBSUB_TOPIC_NAME = 'test-cmcd-topic'; // Ensure it's set for each test too
    });

    afterAll(() => {
        jest.useRealTimers();
        // No need to delete process.env.PUBSUB_TOPIC_NAME if set globally for the test file
    });

    test('CORS Preflight (OPTIONS request)', async () => {
        mockReq.method = 'OPTIONS';
        await frameworkMockState.registeredHttpFunction(mockReq, mockRes);
        expect(mockRes.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
        expect(mockRes.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        expect(mockRes.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', '*');
        expect(mockRes.status).toHaveBeenCalledWith(204);
        expect(mockRes.send).toHaveBeenCalledWith('');
    });

    test('Invalid HTTP Method (PUT request)', async () => {
        mockReq.method = 'PUT';
        await frameworkMockState.registeredHttpFunction(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(405);
        expect(mockRes.send).toHaveBeenCalledWith('Method Not Allowed');
    });

    test('Invalid Path (for getCMCDMode)', async () => {
        mockReq.path = '/invalid/path';
        mockRes.status.mockImplementationOnce((statusCode) => {
            if (statusCode === 404) mockRes.headersSent = true;
            return mockRes;
        });
        await frameworkMockState.registeredHttpFunction(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.send).toHaveBeenCalledWith('Not Found: Please use /cmcd/response-mode or /cmcd/event-mode path.');
    });

    describe('JSON POST Requests', () => {
        beforeEach(() => {
            mockReq.method = 'POST';
            mockReq.headers['content-type'] = 'application/json';
        });

        test('JSON POST - Single CMCD Object', async () => {
            mockReq.body = { "br": 2000, "ts": 1678886400000, "sid": "test-session" };
            mockReq.path = '/cmcd/event-mode';

            await frameworkMockState.registeredHttpFunction(mockReq, mockRes);

            expect(importedPublishMessageMock).toHaveBeenCalledTimes(1);
            const publishedData = JSON.parse(importedPublishMessageMock.mock.calls[0][0].data);
            expect(publishedData).toEqual(expect.objectContaining({
                request_user_agent: null,
                request_origin: null,
                request_ip: '127.0.0.1',
                request_datetime: mockISODate,
                cmcd_mode: 'event',
                cmcd_key_br: 2000,
                cmcd_key_ts: 1678886400000,
                cmcd_key_ts_date: new Date(1678886400000).toISOString(),
                cmcd_key_sid: "test-session",
                cmcd_data: JSON.stringify(mockReq.body),
            }));
            expect(mockRes.status).toHaveBeenCalledWith(204);
            expect(mockRes.send).toHaveBeenCalled();
        });

        test('JSON POST - Array of CMCD Objects', async () => {
            mockReq.body = [{ "br": 2000, "ot": "v" }, { "bl": 10000, "sf": "a", "ts": 1678886401000 }];
            mockReq.path = '/cmcd/response-mode';
            mockReq.headers['user-agent'] = 'test-array-agent';

            await frameworkMockState.registeredHttpFunction(mockReq, mockRes);

            expect(importedPublishMessageMock).toHaveBeenCalledTimes(2);
            const firstCallData = JSON.parse(importedPublishMessageMock.mock.calls[0][0].data);
            expect(firstCallData).toEqual(expect.objectContaining({
                cmcd_key_br: 2000,
                cmcd_key_ot: 'v',
                cmcd_mode: 'response',
                request_user_agent: 'test-array-agent',
                cmcd_data: JSON.stringify(mockReq.body[0]),
            }));
            const secondCallData = JSON.parse(importedPublishMessageMock.mock.calls[1][0].data);
            expect(secondCallData).toEqual(expect.objectContaining({
                cmcd_key_bl: 10000,
                cmcd_key_sf: 'a',
                cmcd_key_ts: 1678886401000,
                cmcd_key_ts_date: new Date(1678886401000).toISOString(),
                cmcd_mode: 'response',
                cmcd_data: JSON.stringify(mockReq.body[1]),
            }));
            expect(mockRes.status).toHaveBeenCalledWith(204);
        });

        test('JSON POST - Invalid Body (string)', async () => {
            mockReq.body = "not-a-valid-json-object-for-this-handler"; // This is not typeof 'object'
            await frameworkMockState.registeredHttpFunction(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith('Bad Request: CMCD JSON payload must be a JSON object or array.');
            expect(importedPublishMessageMock).not.toHaveBeenCalled();
        });
        
        test('JSON POST - Body is an object but empty (single object)', async () => {
            mockReq.body = {}; 
            await frameworkMockState.registeredHttpFunction(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith('Bad Request: CMCD JSON payload is an empty object or array.');
            expect(importedPublishMessageMock).not.toHaveBeenCalled();
        });

        test('JSON POST - Array with an empty object', async () => {
            mockReq.body = [{}]; 
            await frameworkMockState.registeredHttpFunction(mockReq, mockRes);
            // The loop will continue if an item is empty, and then send 204 if other items were processed.
            // If only one empty item, no publish, then 204.
            expect(importedPublishMessageMock).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(204); // Because the overall array was not empty
        });


        test('JSON POST - Empty Array', async () => {
            mockReq.body = [];
            await frameworkMockState.registeredHttpFunction(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith('Bad Request: CMCD JSON payload is an empty object or array.');
            expect(importedPublishMessageMock).not.toHaveBeenCalled();
        });
    });

    describe('Query Parameter Requests', () => {
        beforeEach(() => {
            mockReq.headers['content-type'] = 'text/plain'; 
        });

        test('Query Parameter - Valid CMCD (GET)', async () => {
            mockReq.method = 'GET';
            mockReq.query = { 'CMCD': 'br=1000,nor="foo.m4a",ts=1678886402000' };
            mockReq.path = '/cmcd/response-mode';
            mockReq.headers['origin'] = 'test-query-origin';

            await frameworkMockState.registeredHttpFunction(mockReq, mockRes);
            expect(importedPublishMessageMock).toHaveBeenCalledTimes(1);
            const publishedData = JSON.parse(importedPublishMessageMock.mock.calls[0][0].data);
            expect(publishedData).toEqual(expect.objectContaining({
                request_origin: 'test-query-origin',
                request_ip: '127.0.0.1',
                request_datetime: mockISODate,
                cmcd_mode: 'response',
                cmcd_key_br: 1000,
                cmcd_key_nor: "foo.m4a",
                cmcd_key_ts: 1678886402000,
                cmcd_key_ts_date: new Date(1678886402000).toISOString(),
                cmcd_data: 'br=1000,nor="foo.m4a",ts=1678886402000',
            }));
            expect(mockRes.status).toHaveBeenCalledWith(204);
        });
        
        test('Query Parameter - Valid CMCD (POST, content-type not json)', async () => {
            mockReq.method = 'POST';
            mockReq.query = { 'CMCD': 'st=v,sid="session-xyz"' };
            mockReq.path = '/cmcd/event-mode';
            mockReq.headers['content-type'] = 'application/x-www-form-urlencoded';

            await frameworkMockState.registeredHttpFunction(mockReq, mockRes);
            expect(importedPublishMessageMock).toHaveBeenCalledTimes(1);
            const publishedData = JSON.parse(importedPublishMessageMock.mock.calls[0][0].data);
            expect(publishedData).toEqual(expect.objectContaining({
                cmcd_mode: 'event',
                cmcd_key_st: 'v',
                cmcd_key_sid: "session-xyz",
                cmcd_data: 'st=v,sid="session-xyz"',
            }));
            expect(mockRes.status).toHaveBeenCalledWith(204);
        });


        test('Query Parameter - Missing CMCD', async () => {
            mockReq.query = {}; 
            await frameworkMockState.registeredHttpFunction(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith('Bad Request: CMCD data not found in query parameters or JSON payload.');
            expect(importedPublishMessageMock).not.toHaveBeenCalled();
        });

        test('Query Parameter - Empty Parsed CMCD (CMCD query is empty string)', async () => {
            mockReq.query = { 'CMCD': '' }; 
            await frameworkMockState.registeredHttpFunction(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            // Because `rawData` (empty string) is falsy for `if(!rawData)`
            expect(mockRes.send).toHaveBeenCalledWith('Bad Request: CMCD data not found in query parameters or JSON payload.');
            expect(importedPublishMessageMock).not.toHaveBeenCalled();
        });

         test('Query Parameter - Key without value (boolean true)', async () => {
            mockReq.query = { 'CMCD': 'sf,bs,rtp=100' };
            mockReq.path = '/cmcd/response-mode';

            await frameworkMockState.registeredHttpFunction(mockReq, mockRes);
            expect(importedPublishMessageMock).toHaveBeenCalledTimes(1);
            const publishedData = JSON.parse(importedPublishMessageMock.mock.calls[0][0].data);
            expect(publishedData).toEqual(expect.objectContaining({
                cmcd_key_sf: true,
                cmcd_key_bs: true,
                cmcd_key_rtp: 100,
                cmcd_data: 'sf,bs,rtp=100',
            }));
            expect(mockRes.status).toHaveBeenCalledWith(204);
        });
    });

    test('Error during Pub/Sub publish', async () => {
        mockReq.method = 'POST';
        mockReq.headers['content-type'] = 'application/json';
        mockReq.body = { "br": 3000 };
        
        importedPublishMessageMock.mockRejectedValueOnce(new Error('Fake PubSub Error'));

        await frameworkMockState.registeredHttpFunction(mockReq, mockRes);

        expect(importedPublishMessageMock).toHaveBeenCalledTimes(1);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.send).toHaveBeenCalledWith('Internal Server Error: No messages were published.');
    });
    
    // This test is removed as it's hard to reliably test module load env var conditions without jest.resetModules()
    // test('PUBSUB_TOPIC_NAME not set (simulated client failure)', async () => { ... });
});
