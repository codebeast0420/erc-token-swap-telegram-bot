import { createCanvas, loadImage, registerFont } from "canvas";
import { IAffiliateInfluencer } from "../models/affiliate.influencer.model";
import { getTokenInfo } from "./token.service";
import { getNativeCurrencyPrice, getNativeCurrencySymbol } from "../web3/chain.parameters";
import QRCode from 'qrcode'
import Logging from "../utils/logging";
registerFont('./assets/Manrope-SemiBold.ttf', { family: 'Manrope SemiBold' })

const imagePropotion = 2;
const maxSymbolLenght = 6;
const maxReffLength = 13

export interface IPLCard {
    pair: IPairInfo,
    entry: number,
    worth: number,
    reff?: IAffiliateInfluencer
}

interface IPairInfo {
    chain: string,
    token: string,
}

function drawText(ctx, x, y, text, style, fontSize = 1, fontFamily = "Manrope SemiBold") {
    ctx.font = `${fontSize * imagePropotion}rem ${fontFamily}`;
    ctx.fillStyle = style
    ctx.fillText(text, imagePropotion * x, imagePropotion * y);
}

function resetTextSize(ctx) {
    ctx.font = "1rem ManropeSemibold"
}


export async function createCard(details: IPLCard) {
    try {
        const canvas = createCanvas(1380, 834);
        const ctx = canvas.getContext("2d");

        const nativePrice = Number(await getNativeCurrencyPrice(details.pair.chain))
        const entry = parseFloat(Number(details.entry).toFixed(4))
        const worth = parseFloat(Number(details.worth).toFixed(4))
        const entryInDollars = parseFloat(Number(details.entry * nativePrice).toFixed(2))
        const worthInDollars = parseFloat(Number(details.worth * nativePrice).toFixed(2))
        const isProfit = worth > entry;
        const gainz = `${isProfit ? "+" : "-"}${(((worth * 100) / entry) - 100).toFixed(2)}%`
        let tokenSymbolRaw = (await getTokenInfo(details.pair.chain, details.pair.token)).symbol
        const tokenSymbol = tokenSymbolRaw.length > maxSymbolLenght ? `${tokenSymbolRaw.slice(0, maxSymbolLenght)}...` : tokenSymbolRaw
        const nativeSymbol = await getNativeCurrencySymbol(details.pair.chain)

        // Calculate position of data prices
        resetTextSize(ctx)
        const x_start = 60
        const space_width = 10 * imagePropotion
        const prices_x_bigger = Math.max(ctx.measureText(`${entry}`).width, ctx.measureText(`${worth}`).width) + ctx.measureText(` ${nativeSymbol}`).width
        const prices_x_start = (prices_x_bigger + x_start + ctx.measureText("Worth").width) + space_width
        const prices_x_dollar_start = prices_x_start + (space_width / 4)

        const bgImage = await loadImage(
            "./assets/card_bg.png"
        );

        // center fill
        const hRatio = canvas.width / bgImage.width;
        const vRatio = canvas.height / bgImage.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShift_x = (canvas.width - bgImage.width * ratio) / 2;
        const centerShift_y = (canvas.height - bgImage.height * ratio) / 2;


        ctx.drawImage(
            bgImage,
            0,
            0,
            bgImage.width,
            bgImage.height,
            centerShift_x,
            centerShift_y,
            bgImage.width * ratio,
            bgImage.height * ratio
        );

        // Profit or Loss text
        drawText(ctx, x_start, 117, isProfit ? "Profit" : "Loss", isProfit ? "#2BBD84" : "#E95065")
        ctx.rect(129 * imagePropotion, 93 * imagePropotion, 1 * imagePropotion, 32 * imagePropotion);
        ctx.fillStyle = "#676767";
        ctx.fill();
        drawText(ctx, 145, 117, `${tokenSymbol} / ${nativeSymbol}`, "#CFCFCF")


        //Trade percentage
        drawText(ctx, x_start, 185, gainz, isProfit ? "#2BBD84" : "#E95065", 2.8)

        //Entry and Worth Price
        drawText(ctx, x_start, 225, "Initial", "#CFCFCF")
        drawText(ctx, x_start, 255, "Worth", "#CFCFCF")
        ctx.textAlign = "right"
        drawText(ctx, prices_x_start, 225, `${entry} ${nativeSymbol}`, "#D8AC12")
        drawText(ctx, prices_x_start, 255, `${worth} ${nativeSymbol}`, "#D8AC12")
        ctx.textAlign = "left"
        drawText(ctx, prices_x_dollar_start, 225, `(${entryInDollars}$)`, "#CFCFCF", 0.7)
        drawText(ctx, prices_x_dollar_start, 255, `(${worthInDollars}$)`, "#CFCFCF", 0.7)


        //QR code https://chartai.tech/
        let refName = "NULL"
        let url = "https://t.me/Zehereelabot"
        if (details.reff !== undefined && details.reff.ref !== undefined) {
            refName = details.reff.ref.match(/https:\/\/chartai\.tech\/(.*)/)[1]
            url = `https://t.me/Zehereelabot?start=chartai_code_${refName}`
        }
        const isShrinking = refName.length > maxReffLength

        let qrData = await QRCode.toDataURL(url, { width: 360 });
        const qrImage = await loadImage(
            qrData
        );

        ctx.drawImage(
            qrImage,
            0,
            0,
            qrImage.width,
            qrImage.height,
            59 * imagePropotion,
            296 * imagePropotion,
            qrImage.width * ratio,
            qrImage.height * ratio
        );

        // QR code info
        drawText(ctx, 166, 320, "Referral Code", "#CFCFCF", 0.9)
        drawText(ctx, 166, 350, `${isShrinking ? `${refName.slice(0, maxReffLength)}...` : refName}`, "#FFFFFF", 1.2)
        // drawText(ctx, 166, 375, "Get The Swift App", "#D8AC12", 0.9)


        // Graphics
        const imagePath = isProfit ? "./assets/profit_graphics.png" : "./assets/loss_graphics.png"
        const graphicsImage = await loadImage(
            imagePath
        );

        ctx.drawImage(
            graphicsImage,
            0,
            0,
            graphicsImage.width,
            graphicsImage.height,
            280 * imagePropotion,
            30 * imagePropotion,
            graphicsImage.width * ratio,
            graphicsImage.height * ratio
        );

        return canvas.toBuffer()
    } catch (err) {
        Logging.error('[createCard]')
        console.error(err)
    }
}