import { Schema, model, type InferSchemaType } from "mongoose";

// Un libro que el usuario quiere tener, aparte de su biblioteca (D-036): no es
// un Ejemplar, así que no tiene estado de lectura, ubicación, etiquetas ni
// citas. Apunta al Libro compartido, que nunca se edita desde aquí.
const wishlistItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    note: { type: String },
  },
  { timestamps: true },
);

// Un usuario no puede desear dos veces el mismo Libro.
wishlistItemSchema.index({ userId: 1, bookId: 1 }, { unique: true });
// Lista paginada: los deseados del usuario, el más reciente primero.
wishlistItemSchema.index({ userId: 1, createdAt: -1, _id: -1 });

export type WishlistItemDocument = InferSchemaType<typeof wishlistItemSchema>;

const WishlistItem = model("WishlistItem", wishlistItemSchema);

export default WishlistItem;
