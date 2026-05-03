import { model, Schema, type InferSchemaType, type Types } from "mongoose";

import { INSIGHT_TYPES } from "../types/generatedInsight.js";

const insightSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: INSIGHT_TYPES,
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    signature: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    createdAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  {
    versionKey: false,
    timestamps: { createdAt: false, updatedAt: true },
  },
);

insightSchema.index({ userId: 1, type: 1, signature: 1 }, { unique: true });
insightSchema.index({ userId: 1, createdAt: -1 });
insightSchema.index({ userId: 1, type: 1, createdAt: -1 });

export type InsightDocument = InferSchemaType<typeof insightSchema> & {
  _id: Types.ObjectId;
};

export const InsightModel = model("Insight", insightSchema);
