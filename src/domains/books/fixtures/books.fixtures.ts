import type { CreateBookDto } from "../types/types.js";

// ISBN-13 válidos con dígito de control correcto; el segundo es otra edición.
export const ISBN_13 = "9780306406157";
export const ISBN_10_OF_ISBN_13 = "0306406152";
export const OTHER_EDITION_ISBN_13 = "9788437604947";

export const validCreateBookDto: CreateBookDto = {
  isbn: ISBN_13,
  title: "La sombra del viento",
  authors: ["Carlos Ruiz Zafón"],
  publisher: "Planeta",
  publishedYear: 2001,
  pageCount: 576,
  language: "es",
  coverUrl: "https://books.google.com/covers/sombra.jpg",
  coverSource: "google_books",
  synopsis: "Barcelona, 1945.",
  categories: ["Ficción"],
  status: "pending",
};

export const buildCreateBookDto = (
  overrides: Partial<CreateBookDto> = {},
): CreateBookDto => ({
  ...validCreateBookDto,
  ...overrides,
});

// Libro sin ISBN: alta manual mínima (título, autor y editorial).
export const buildManualBookDto = (
  overrides: Partial<CreateBookDto> = {},
): Partial<CreateBookDto> => ({
  title: "Apuntes de un viaje",
  authors: ["Autora Anónima"],
  publisher: "Edición del autor",
  ...overrides,
});
