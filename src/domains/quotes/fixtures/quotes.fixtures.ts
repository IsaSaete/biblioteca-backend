import type { CreateQuoteDto } from "../types/types.js";

export const buildCreateQuoteDto = (
  ejemplarId: string,
  overrides: Partial<CreateQuoteDto> = {},
): Partial<CreateQuoteDto> => ({
  ejemplarId,
  text: "Cuando se vive en una casa de libros, nunca se está solo.",
  page: 9,
  ...overrides,
});
