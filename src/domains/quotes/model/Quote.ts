import { Schema, model, type InferSchemaType } from "mongoose";
import { QUOTE_ORIGINS } from "../types/types.js";

const quoteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Sin ejemplarId la cita no está vinculada a ningún libro (D-023).
    ejemplarId: { type: Schema.Types.ObjectId, ref: "Ejemplar" },
    text: { type: String, required: true },
    page: { type: Number },
    // Solo en citas sin libro: de dónde sale la cita.
    source: { type: String },
    origin: {
      type: String,
      enum: QUOTE_ORIGINS,
      required: true,
      default: "manual",
    },
  },
  { timestamps: true },
);

quoteSchema.index({ ejemplarId: 1 });
// Feed paginado: las citas del usuario, la más reciente primero.
quoteSchema.index({ userId: 1, createdAt: -1, _id: -1 });

export type QuoteDocument = InferSchemaType<typeof quoteSchema>;

const Quote = model("Quote", quoteSchema);

export default Quote;
