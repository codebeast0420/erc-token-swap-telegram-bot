export class BotMessage {
    public static startMessage(walletAddress?: string, balance?: any) {
        return `<b>ChartAI Snipper</b> 🔫
Welcome to the ChartAI sniper bot. Snipe by pasting a contract address or select an action from the menu.
Send /help for list of commands.

<b>Balance: ${balance} ETH</b>
<b>Address: <code>${walletAddress || "Null"}</code></b>
`;
    }

    public static linkAccountMessage(telegramId: string) {
        return `
🔗 <b>Link dapp account</b>
scan the QR on mobile or enter code on desktop:
enter code <b>S-<code>${telegramId}</code></b>
`;
    }

    public preAuthMessage(key: string, ip: string, device: string) {
        let signInKey = "";
        const signInKeyTemp = key.split(" ");

        for (let i = 0; i < signInKeyTemp.length; i++) {
            if (i == 0) {
                signInKey = `${i + 1}.${signInKeyTemp[i]}`;
            } else {
                signInKey += ` ${i + 1}.${signInKeyTemp[i]}`;
            }
        }

        return `<b>You’ve initiated a request to Login</b>

👀 ip: ${ip}
🌐 device: ${device}

🔐 Sign In Key: <b><code>${signInKey}</code></b>

<i>⚠️ If you did not request this login, just ignore it.</i>
    `;
    }
}
