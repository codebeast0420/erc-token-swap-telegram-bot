import { Schema, model } from 'mongoose';

const connectedChainSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'AppUser' },
    selected: { type: Boolean, required: true, default: false },
    chain: {
        type: String,
        required: true,
        default: ''
    }
});

export const ConnectedChainModel = model('ConnectedChain', connectedChainSchema);
