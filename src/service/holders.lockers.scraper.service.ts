import axios from "axios";
import Logging from "../utils/logging";
import { getBlockExplorer } from "../web3/chain.parameters";
import { PINKSALE_CA, PINKSALE_LOCK_TITLE, UNCX_CA, UNCX_NETWORK_SECURITY } from "../utils/common";


const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

export const keys = [
    'rank',
    'address',
    'quantity',
    'percentage'
]





export class HoldersLockedLpScrapingService {
    public async getTopHolders(chain: string, tokenAddress: string) {
        const explorer = await getBlockExplorer(chain);
        const totalHolders = await getTotalHolders(tokenAddress, explorer, '#ctl00 > div.container.space-bottom-2.mt-4 > div.card > div.card-header.py-4 > div > div:nth-child(2) > span')
        const topHolders = await getHolders(tokenAddress, explorer, '#ContentPlaceHolder1_resultrows > table > tbody > tr')

        return { totalHolders: totalHolders, topHolders: topHolders }
    }



    public async getTopLocker(chain: string, tokenInfo: any) {
        const explorer = await getBlockExplorer(chain);

        if (tokenInfo.lp?.length > 0) {
            tokenInfo.lp.map(async lp => {
                const topHolders = await getHolders(lp.lp, explorer, '#ContentPlaceHolder1_resultrows > table > tbody > tr')
                Logging.info(topHolders)
                if (topHolders?.length > 0) {
                    topHolders.map(async th => {

                        if (th.address.charAt(0) === ' ' && th.address === PINKSALE_LOCK_TITLE) {
                            await getTransactionHash(lp.lp, explorer, PINKSALE_CA)
                        } else if (th.address.charAt(0) === ' ' && th.address === UNCX_NETWORK_SECURITY) {
                            await getTransactionHash(lp.lp, explorer, UNCX_CA)
                        }

                    })
                }
            })
        }


        //   const totalLpHolders = await getTotalHolders(tokenAddress, explorer, '#ctl00 > div.container.space-bottom-2.mt-4 > div.card > div.card-header.py-4 > div > div:nth-child(2) > span')
    }
}


async function getTotalHolders(token: string, explorer: string, elementSelector: string) {
    let totalHolders;
    const url = `${explorer}/token/tokenholderchart/${token}`;
    try {
        const response = await axios.get(url)
        const $ = cheerio.load(response.data)

        $(elementSelector).each((parentIndex: number, parentElement: any) => {
            const totalHoldersValue = $(parentElement).text()

            if (totalHoldersValue) {
                totalHolders = totalHoldersValue.replace("Token Holders: ", "")
            }
        })

        return totalHolders
    } catch (err) {
        Logging.error('[getTotalHolders] axios error')
    }
}

async function getHolders(token: string, explorer: string, elementSelector: string) {
    let holdersData = []
    const url = `${explorer}/token/tokenholderchart/${token}`;
    try {
        const response = await axios.get(url)
        const $ = cheerio.load(response.data)


        $(elementSelector).each((parentIndex: number, parentElement: any) => {
            let keyIndex = 0;
            const holderObj = {}
            if (parentIndex <= 5) {
                $(parentElement).children().each((childIndex: number, childElement: any) => {
                    const tdValue = $(childElement).text()

                    if (tdValue) {
                        holderObj[keys[keyIndex]] = tdValue
                        keyIndex++
                    }
                })
                holdersData.push(holderObj)
            }
        })

        return holdersData;
    } catch (e) {
        Logging.error('[getHolders] axios error')
    }
}


async function getTransactionHash(token: string, explorer: string, lockerAddress: string) {

    const url = `${explorer}/token/${token}?a=${lockerAddress}`;
    Logging.info(url)
    try {
        const browser = await puppeteer.launch({
            headless: false,
        });
        const page = await browser.newPage();
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
        });
        await page.goto(url);



        // Wait for the website to fully render
        await page.waitForXPath('//*[@id="maindiv"]/div[2]/table/tbody/tr/td[1]/span/a');

        // locker
        let [lockerElem] = await page.$x('//*[@id="maindiv"]/div[2]/table/tbody/tr[1]/td[7]/span/a');
        let locker = await page.evaluate(element => element.textContent, lockerElem);

        Logging.info(locker)
        Logging.info(`found table length: `)

        //  await browser.close();

    } catch (err) {
        console.error(`==> ${new Date().toLocaleString()}`)
        console.error(err)
        Logging.error(err)
    }
}








async function getLockedForHowLong() { }