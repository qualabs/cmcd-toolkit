import { cmcdExtractorService } from '../cmcd-extractor.service.js';
import parseCMCDQueryToJson from '../parseCMCDQueryToJson.js';
import saveBigQuery from '../bigquery.js';
import savePubSub from '../pubsub.js';

jest.mock('../parseCMCDQueryToJson.js');
jest.mock('../bigquery.js');
jest.mock('../pubsub.js');

describe('cmcdExtractorService', () => {
    let mockReq;
    const mockISODate = '2024-01-01T00:00:00.000Z';

    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(mockISODate));
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockReq = {
            headers: {},
            body: null,
            query: {},
            ip: '127.0.0.1',
        };
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    describe('JSON POST Requests', () => {
        it('should process a single CMCD object in req.body', async () => {
            mockReq.headers = { 'content-type': 'application/json', 'user-agent': 'test-agent', origin: 'test-origin' };
            mockReq.body = { "br": 2000, "sf": "h", "ts": 1678886400000 }; // ts is a Unix timestamp in ms
            const cmcdMode = 'event';

            await cmcdExtractorService({ req: mockReq, cmcdMode });

            expect(saveBigQuery).toHaveBeenCalledTimes(1);
            expect(savePubSub).toHaveBeenCalledTimes(1);
            expect(saveBigQuery).toHaveBeenCalledWith(expect.objectContaining({
                request_user_agent: 'test-agent',
                request_origin: 'test-origin',
                request_ip: '127.0.0.1',
                request_datetime: mockISODate,
                cmcd_mode: 'event',
                cmcd_key_br: 2000,
                cmcd_key_sf: "h",
                cmcd_key_ts: 1678886400000,
                cmcd_key_ts_date: new Date(1678886400000).toISOString(), // This will use the real Date for calculation, then mocked toISOString
                cmcd_data: JSON.stringify({ "br": 2000, "sf": "h", "ts": 1678886400000 }),
            }));
        });

        it('should process an array of CMCD objects in req.body', async () => {
            mockReq.headers = { 'content-type': 'application/json', 'user-agent': 'test-agent-array', origin: 'test-origin-array' };
            mockReq.body = [
                { "br": 2000, "ot": "v" },
                { "d": 1000, "sf": "a", "ts": 1678886401000 }
            ];
            const cmcdMode = 'response';

            await cmcdExtractorService({ req: mockReq, cmcdMode });

            expect(saveBigQuery).toHaveBeenCalledTimes(2);
            expect(savePubSub).toHaveBeenCalledTimes(2);

            expect(saveBigQuery).toHaveBeenNthCalledWith(1, expect.objectContaining({
                request_user_agent: 'test-agent-array',
                request_origin: 'test-origin-array',
                request_ip: '127.0.0.1',
                request_datetime: mockISODate,
                cmcd_mode: 'response',
                cmcd_key_br: 2000,
                cmcd_key_ot: "v",
                cmcd_data: JSON.stringify({ "br": 2000, "ot": "v" }),
            }));
            expect(saveBigQuery).toHaveBeenNthCalledWith(2, expect.objectContaining({
                request_user_agent: 'test-agent-array',
                request_origin: 'test-origin-array',
                request_ip: '127.0.0.1',
                request_datetime: mockISODate,
                cmcd_mode: 'response',
                cmcd_key_d: 1000,
                cmcd_key_sf: "a",
                cmcd_key_ts: 1678886401000,
                cmcd_key_ts_date: new Date(1678886401000).toISOString(),
                cmcd_data: JSON.stringify({ "d": 1000, "sf": "a", "ts": 1678886401000 }),
            }));
        });

        it('should not call saveData if req.body is an empty array', async () => {
            mockReq.headers = { 'content-type': 'application/json' };
            mockReq.body = [];
            const cmcdMode = 'event';

            await cmcdExtractorService({ req: mockReq, cmcdMode });

            expect(saveBigQuery).not.toHaveBeenCalled();
            expect(savePubSub).not.toHaveBeenCalled();
        });

        it('should fall through to query param logic if req.body is not a valid JSON structure (e.g. string) and no CMCD query param', async () => {
            mockReq.headers = { 'content-type': 'application/json', 'user-agent': 'test-agent' };
            mockReq.body = "this is not json"; // Invalid JSON body
            const cmcdMode = 'event';

            await cmcdExtractorService({ req: mockReq, cmcdMode });

            // Since it falls through and there's no req.query.CMCD, parseCMCDQueryToJson won't be called by the query path
            // and subsequently saveData won't be called.
            expect(parseCMCDQueryToJson).not.toHaveBeenCalled();
            expect(saveBigQuery).not.toHaveBeenCalled();
            expect(savePubSub).not.toHaveBeenCalled();
        });

         it('should process as query param if content-type is json but body is null/undefined', async () => {
            mockReq.headers = { 'content-type': 'application/json', 'user-agent': 'test-agent' };
            mockReq.body = null;
            mockReq.query = { 'CMCD': 'st=v,sid="test-sid"' };
            parseCMCDQueryToJson.mockReturnValue({ st: 'v', sid: 'test-sid' });
            const cmcdMode = 'event';

            await cmcdExtractorService({ req: mockReq, cmcdMode });
            
            expect(parseCMCDQueryToJson).toHaveBeenCalledWith('st=v,sid="test-sid"');
            expect(saveBigQuery).toHaveBeenCalledTimes(1);
            expect(savePubSub).toHaveBeenCalledTimes(1);
             expect(saveBigQuery).toHaveBeenCalledWith(expect.objectContaining({
                cmcd_key_st: 'v',
                cmcd_key_sid: 'test-sid',
                cmcd_data: 'st=v,sid="test-sid"',
            }));
        });
    });

    describe('Query Parameter Requests', () => {
        it('should process valid CMCD data from req.query.CMCD', async () => {
            mockReq.headers = { 'user-agent': 'query-agent', origin: 'query-origin' };
            mockReq.query = { 'CMCD': 'br=1000,sf=h,ts=1678886402000' };
            const mockParsedCmcd = { br: 1000, sf: 'h', ts: 1678886402000 };
            parseCMCDQueryToJson.mockReturnValue(mockParsedCmcd);
            const cmcdMode = 'response';

            await cmcdExtractorService({ req: mockReq, cmcdMode });

            expect(parseCMCDQueryToJson).toHaveBeenCalledWith('br=1000,sf=h,ts=1678886402000');
            expect(saveBigQuery).toHaveBeenCalledTimes(1);
            expect(savePubSub).toHaveBeenCalledTimes(1);
            expect(saveBigQuery).toHaveBeenCalledWith(expect.objectContaining({
                request_user_agent: 'query-agent',
                request_origin: 'query-origin',
                request_ip: '127.0.0.1',
                request_datetime: mockISODate,
                cmcd_mode: 'response',
                cmcd_key_br: 1000,
                cmcd_key_sf: "h",
                cmcd_key_ts: 1678886402000,
                cmcd_key_ts_date: new Date(1678886402000).toISOString(),
                cmcd_data: 'br=1000,sf=h,ts=1678886402000',
            }));
        });

        it('should not call saveData if req.query.CMCD is missing', async () => {
            mockReq.headers = { 'user-agent': 'no-cmcd-agent' };
            // req.query.CMCD is undefined
            const cmcdMode = 'event';

            await cmcdExtractorService({ req: mockReq, cmcdMode });

            expect(parseCMCDQueryToJson).not.toHaveBeenCalled();
            expect(saveBigQuery).not.toHaveBeenCalled();
            expect(savePubSub).not.toHaveBeenCalled();
        });

        it('should correctly add request details for query parameter requests', async () => {
            mockReq.headers = { 'user-agent': 'detail-agent', origin: 'detail-origin' };
            mockReq.ip = '192.168.1.1';
            mockReq.query = { 'CMCD': 'nor=test.media' };
            parseCMCDQueryToJson.mockReturnValue({ nor: 'test.media' });
            const cmcdMode = 'event';
            // jest.setSystemTime for specific test if different date is needed
            // For this test, the global mockISODate is fine.

            await cmcdExtractorService({ req: mockReq, cmcdMode });

            expect(saveBigQuery).toHaveBeenCalledWith(expect.objectContaining({
                request_user_agent: 'detail-agent',
                request_origin: 'detail-origin',
                request_ip: '192.168.1.1',
                request_datetime: mockISODate, // All tests will use this mock date
                cmcd_mode: 'event',
                cmcd_key_nor: 'test.media',
            }));
        });
    });

    describe('General Behavior', () => {
        it('should not call saveData if no CMCD data is present in JSON or query', async () => {
            mockReq.headers = { 'user-agent': 'no-data-agent' };
            // body is null, query.CMCD is undefined
            const cmcdMode = 'response';

            await cmcdExtractorService({ req: mockReq, cmcdMode });

            expect(saveBigQuery).not.toHaveBeenCalled();
            expect(savePubSub).not.toHaveBeenCalled();
        });
    });
});

// Helper to access the saveData function if it were exported and needed direct testing,
// but here we are testing cmcdExtractorService and its effects on saveData's components.
// For the current structure, we check saveBigQuery and savePubSub.
