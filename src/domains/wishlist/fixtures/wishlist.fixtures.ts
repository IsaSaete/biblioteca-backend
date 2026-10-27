import type { CreateBookDto } from "../../books/types/types.js";
import { buildCreateBookDto } from "../../books/fixtures/books.fixtures.js";

// El alta de un deseado lleva los mismos datos que la de un libro, pero sin
// estado de lectura.
export const buildAddToWishlistDto = (
  overrides: Partial<CreateBookDto> & { note?: string } = {},
): Record<string, unknown> => {
  const { status: _status, ...bookFields } = buildCreateBookDto();

  return { ...bookFields, ...overrides };
};
