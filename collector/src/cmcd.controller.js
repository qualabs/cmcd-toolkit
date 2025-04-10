import { cmcdExtractorService } from './cmcd-extractor.service.js';

export const cmcdRequest = (req, res, cmcdMode) => {
    cmcdExtractorService({req, cmcdMode});
    res.send('ok');
};