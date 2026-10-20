import { Schema, model, type InferSchemaType } from "mongoose";
import { COVER_SOURCES } from "../types/types.js";

// Libro es inmutable una vez creado: ningún servicio lo actualiza. Las
// correcciones de un usuario viven en Ejemplar.overrides.
const bookSchema = new Schema(
  {
    isbn: { type: String },
    title: { type: String, required: true },
    authors: { type: [String], required: true },
    publisher: { type: String, required: true },
    publishedYear: { type: Number },
    pageCount: { type: Number },
    language: { type: String },
    coverUrl: { type: String },
    coverSource: { type: String, enum: COVER_SOURCES },
    synopsis: { type: String },
    categories: { type: [String], default: undefined },
  },
  { timestamps: true },
);

// Único solo cuando hay ISBN: los libros dados de alta a mano no lo tienen.
bookSchema.index(
  { isbn: 1 },
  { unique: true, partialFilterExpression: { isbn: { $type: "string" } } },
);
bookSchema.index({ title: "text", authors: "text" });

export type BookDocument = InferSchemaType<typeof bookSchema>;

const Book = model("Book", bookSchema);

export default Book;
