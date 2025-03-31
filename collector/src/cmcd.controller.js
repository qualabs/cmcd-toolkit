import { cmcdExtractorService } from './cmcd-extractor.service.js';

export const cmcdRequest = (req, res, cmcdMode) => {
    req.dateStart = new Date().toISOString();
    const dateStart = req.dateStart;
    const reqURI= req.reqURI;
    cmcdExtractorService({req, reqURI, dateStart, cmcdMode});
    res.send('ok');
};