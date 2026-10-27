import type { Types } from "mongoose";
import mapBookToDto, {
  type BookRecord,
} from "../../books/mapper/mapBookToDto.js";
import type { WishlistItemDocument } from "../model/WishlistItem.js";
import type { WishlistItemDto } from "../types/types.js";

export type WishlistItemRecord = WishlistItemDocument & { _id: Types.ObjectId };

const mapWishlistItemToDto = (
  item: WishlistItemRecord,
  book: BookRecord,
): WishlistItemDto => ({
  id: item._id.toString(),
  book: mapBookToDto(book),
  ...(item.note && { note: item.note }),
  createdAt: item.createdAt.toISOString(),
});

export default mapWishlistItemToDto;
