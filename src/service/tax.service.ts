import Logging from "../utils/logging";


const cheerio = require('cheerio');
const Web3 = require('web3')
const puppeteer = require('puppeteer');

async function getTax(chain: string, pool: string) {
    let response = {
        buy: null,
        sell: null,
    }

    try {
        const url = `https://www.geckoterminal.com/${chain}/pools/${pool}`

        const browser = await puppeteer.launch({
            //   headless: false,
        });
        const page = await browser.newPage();
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
        });

        await page.goto(url);

        // Wait for the website to fully render
        await page.waitForXPath('//*[@id="__next"]/div[3]/main/div[1]/div[1]/div[2]/div[3]/div/div[1]/ul/li[2]/div[2]/div/span');

        let [buyTaxElement] = await page.$x('//*[@id="__next"]/div[3]/main/div[1]/div[1]/div[2]/div[3]/div/div[1]/ul/li[2]/div[2]/div/span');
        let buyTaxText = await page.evaluate(element => element.textContent, buyTaxElement);

        let [sellTaxElement] = await page.$x('//*[@id="__next"]/div[3]/main/div[1]/div[1]/div[2]/div[3]/div/div[1]/ul/li[3]/div[2]/div/span');
        let sellTaxText = await page.evaluate(element => element.textContent, sellTaxElement);

        if (/^\d+(\.\d+)?%$/.test(buyTaxText.trim()) && /^\d+(\.\d+)?%$/.test(sellTaxText.trim())) {
            Logging.info(`buy tax: ${buyTaxText.trim()} sell tax: ${sellTaxText.trim()}`)

            response.buy = buyTaxText.trim()
            response.sell = sellTaxText.trim()
        }

        //  await browser.close();

    } catch (err) {
        console.error(`==> ${new Date().toLocaleString()}`)
        console.error(err)
        Logging.error(err.message)
    }

    return response;
}

async function getTokenTaxesBsc(tokenAddress: string) {

    let response = {
        buy: null,
        sell: null,
    }
    try {
        const url = `https://honeypot.is/?address=${tokenAddress}`

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: 'networkidle0' });

        // Wait for the website to fully render
        await page.waitForXPath('//*[@id="hp_info_box"]/div/div/div[2]/ul/div/li[1]/p');
        let [buyTaxElement] = await page.$x('//*[@id="hp_info_box"]/div/div/div[2]/ul/div/li[1]/p');
        let buyTaxText = await page.evaluate(element => element.textContent, buyTaxElement);

        let [sellTaxElement] = await page.$x('//*[@id="hp_info_box"]/div/div/div[2]/ul/div/li[4]/p');
        let sellTaxText = await page.evaluate(element => element.textContent, sellTaxElement);

        if (/^\d+(\.\d+)?%$/.test(buyTaxText.trim()) && /^\d+(\.\d+)?%$/.test(sellTaxText.trim())) {
            Logging.info(`buy tax: ${buyTaxText.trim()} sell tax: ${sellTaxText.trim()}`)

            response.buy = buyTaxText.trim()
            response.sell = sellTaxText.trim()
        }

        await browser.close();
    } catch (err) {
        console.error(`==> ${new Date().toLocaleString()}`)
        console.error(err)
        Logging.error(err.message)
    }

    return response;
}


async function getTokenTaxesEth(tokenAddress: string) {

    let response = {
        buy: null,
        sell: null,
    }
    try {
        const url = `https://honeypot.is/ethereum?address=${tokenAddress}`

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: 'networkidle0' });

        // Wait for the website to fully render
        await page.waitForXPath('//*[@id="hp_info_box"]/div/div/div[2]/ul/div/li[1]/p');
        let [buyTaxElement] = await page.$x('//*[@id="hp_info_box"]/div/div/div[2]/ul/div/li[1]/p');
        let buyTaxText = await page.evaluate(element => element.textContent, buyTaxElement);

        let [sellTaxElement] = await page.$x('//*[@id="hp_info_box"]/div/div/div[2]/ul/div/li[4]/p');
        let sellTaxText = await page.evaluate(element => element.textContent, sellTaxElement);

        if (/^\d+(\.\d+)?%$/.test(buyTaxText.trim()) && /^\d+(\.\d+)?%$/.test(sellTaxText.trim())) {
            Logging.info(`buy tax: ${buyTaxText.trim()} sell tax: ${sellTaxText.trim()}`)

            response.buy = buyTaxText.trim()
            response.sell = sellTaxText.trim()
        }





        await browser.close();
    } catch (err) {
        console.error(`==> ${new Date().toLocaleString()}`)
        console.error(err)
        Logging.error(err.message)
    }

    return response;
}





