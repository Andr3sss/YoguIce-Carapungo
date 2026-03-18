import * as puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        page.on('console', msg => console.log('B-CONSOLE:', msg.text()));
        page.on('pageerror', err => console.log('B-ERROR:', err.message));
        
        await page.goto('http://localhost:5173');
        await new Promise(r => setTimeout(r, 2000));
        await browser.close();
    } catch (e) {
        console.error(e);
    }
})();
