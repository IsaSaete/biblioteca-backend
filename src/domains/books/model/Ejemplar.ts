import { Schema, model, type InferSchemaType } from "mongoose";
import { FORMATS, PROVENANCES, READING_STATUSES } from "../types/types.js";

const overridesSchema = new Schema(
  {
    title: { type: String },
    authors: { type: [String], default: undefined },
    publisher: { type: String },
    publishedYear: { type: Number },
    pageCount: { type: Number },
    language: { type: String },
    synopsis: { type: String },
    categories: { type: [String], default: undefined },
  },
  { _id: false },
);

const ejemplarSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    status: {
      type: String,
      enum: READING_STATUSES,
      required: true,
      default: "pending",
    },
    favorite: { type: Boolean, required: true, default: false },
    location: { type: String },
    format: { type: String, enum: FORMATS },
    provenance: { type: String, enum: PROVENANCES },
    acquisitionDate: { type: Date },
    notes: { type: String },
    tags: { type: [String], default: undefined },
    overrides: { type: overridesSchema },
  },
  { timestamps: true },
);

// Un usuario no puede tener dos veces el mismo Libro.
ejemplarSchema.index({ userId: 1, bookId: 1 }, { unique: true });
ejemplarSchema.index({ userId: 1 });

export type EjemplarDocument = InferSchemaType<typeof ejemplarSchema>;

const Ejemplar = model("Ejemplar", ejemplarSchema);

export default Ejemplar;
