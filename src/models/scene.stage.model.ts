import { Schema, model } from 'mongoose';
import { IAppUser } from './app.user.model';

export interface ISceneStage {
    owner: IAppUser;
    name: string;
    text: string;
    date: Date;
}

const sceneStageSchema = new Schema<ISceneStage>(
    {
        owner: { type: Schema.Types.ObjectId, ref: 'AppUser' },
        name: { type: String, required: true },
        text: { type: String, required: true },
        date: { type: Date, required: true }
    },
    { timestamps: true }
);

export const SceneStageModel = model<ISceneStage>('SceneStage', sceneStageSchema);
