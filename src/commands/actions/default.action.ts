import { processError } from "../../service/error";

export const postStartAction = async (ctx: any) => {
    try {
        await ctx.telegram.sendMessage(ctx.chat.id, `You haven't started yet\n\nPlease start your trading here by /start and connect wallet`)
    } catch (err) {
        await processError(ctx, ctx.from.id, err);
    }
}
