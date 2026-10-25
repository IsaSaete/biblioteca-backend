import { Types, type PipelineStage } from "mongoose";
import ConflictError from "../../../shared/errors/ConflictError.js";
import NotFoundError from "../../../shared/errors/NotFoundError.js";
import Book from "../model/Book.js";
import Ejemplar from "../model/Ejemplar.js";
import Quote from "../../quotes/model/Quote.js";
import mapBookToDto, { type BookRecord } from "../mapper/mapBookToDto.js";
import mapEjemplarToDto, {
  type EjemplarRecord,
} from "../mapper/mapEjemplarToDto.js";
import validateCreateBookDto from "../validator/validateCreateBookDto.js";
import validateUpdateEjemplarDto from "../validator/validateUpdateEjemplarDto.js";
import validateListLibraryQuery from "../validator/validateListLibraryQuery.js";
import buildSearchPattern, {
  escapeRegex,
} from "../utils/buildSearchPattern.js";
import {
  decodeLibraryCursor,
  encodeLibraryCursor,
} from "../utils/libraryCursor.js";
import type {
  BookEditableFields,
  BookTagsDto,
  CreateBookDto,
  EjemplarDto,
  LibraryItemDto,
  LibraryPageDto,
  UpdateEjemplarDto,
} from "../types/types.js";

export const LIBRARY_PAGE_SIZE = 24;

const MONGO_DUPLICATE_KEY_ERROR = 11000;

const BOOK_ALREADY_IN_LIBRARY = new ConflictError(
  "BOOK_ALREADY_IN_LIBRARY",
  "Este libro ya está en tu biblioteca",
);

const BOOK_NOT_FOUND = new NotFoundError(
  "BOOK_NOT_FOUND",
  "El libro no está en tu biblioteca",
);

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === MONGO_DUPLICATE_KEY_ERROR;

const isSameValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

// Lo que el usuario ha cambiado respecto al Libro compartido en «Confirma los
// datos». Un campo que no envía no cuenta como corrección.
const buildOverrides = (
  book: BookRecord,
  dto: CreateBookDto,
): Partial<BookEditableFields> | undefined => {
  const overrides: Partial<BookEditableFields> = {};
  const editableKeys = [
    "title",
    "authors",
    "publisher",
    "publishedYear",
    "pageCount",
    "language",
    "synopsis",
    "categories",
  ] as const satisfies readonly (keyof BookEditableFields)[];

  for (const key of editableKeys) {
    if (dto[key] !== undefined && !isSameValue(dto[key], book[key])) {
      Object.assign(overrides, { [key]: dto[key] });
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
};

const findOrCreateBook = async (
  dto: CreateBookDto,
): Promise<{ book: BookRecord; isNew: boolean }> => {
  if (dto.isbn) {
    const existingBook = await Book.findOne({ isbn: dto.isbn }).lean();

    if (existingBook) {
      return { book: existingBook, isNew: false };
    }
  }

  try {
    const { status: _status, ...bookFields } = dto;
    const createdBook = await Book.create(bookFields);

    return { book: createdBook.toObject(), isNew: true };
  } catch (error) {
    // Otra petición creó el mismo ISBN entre la comprobación y el alta.
    if (dto.isbn && isDuplicateKeyError(error)) {
      const concurrentBook = await Book.findOne({ isbn: dto.isbn }).lean();

      if (concurrentBook) {
        return { book: concurrentBook, isNew: false };
      }
    }

    throw error;
  }
};

const createBook = async (
  userId: string,
  body: unknown,
): Promise<LibraryItemDto> => {
  const dto = validateCreateBookDto(body);
  const { book, isNew } = await findOrCreateBook(dto);

  if (!isNew) {
    const alreadyOwned = await Ejemplar.exists({ userId, bookId: book._id });

    if (alreadyOwned) {
      throw BOOK_ALREADY_IN_LIBRARY;
    }
  }

  try {
    const overrides = isNew ? undefined : buildOverrides(book, dto);
    const ejemplar = await Ejemplar.create({
      userId,
      bookId: book._id,
      status: dto.status,
      ...(overrides && { overrides }),
    });

    return {
      book: mapBookToDto(book),
      ejemplar: mapEjemplarToDto(ejemplar.toObject()),
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw BOOK_ALREADY_IN_LIBRARY;
    }

    throw error;
  }
};

interface LibraryRow extends EjemplarRecord {
  book: BookRecord;
}

// Cada palabra del texto buscado debe aparecer en el título, los autores o las
// etiquetas, sin distinguir mayúsculas ni tildes. Título y autores son los que
// el usuario ve, con sus correcciones (overrides) ya aplicadas.
const buildSearchStages = (search: string): PipelineStage[] => {
  const joinWords = (words: unknown) => ({
    $reduce: {
      input: words,
      initialValue: "",
      in: { $concat: ["$$value", "\n", "$$this"] },
    },
  });

  return [
    {
      $addFields: {
        searchText: {
          $concat: [
            { $ifNull: ["$overrides.title", "$book.title"] },
            joinWords({ $ifNull: ["$overrides.authors", "$book.authors"] }),
            joinWords({ $ifNull: ["$tags", []] }),
          ],
        },
      },
    },
    {
      $match: {
        $and: search.split(/\s+/).map((word) => ({
          searchText: { $regex: buildSearchPattern(word), $options: "i" },
        })),
      },
    },
  ];
};

interface LibraryFilters {
  search?: string;
  tag?: string;
  untagged?: boolean;
  favorite?: boolean;
}

interface LibraryPipelineOptions extends LibraryFilters {
  sort: "recent" | "alpha";
  cursor?: ReturnType<typeof decodeLibraryCursor>;
}

// Los libros del usuario que cumplen los filtros, con su Libro unido. Es la
// base de la tanda y del recuento total, para que ambos coincidan siempre.
const buildFilteredLibraryStages = (
  userId: string,
  { search, tag, untagged, favorite }: LibraryFilters,
): PipelineStage[] => [
  {
    $match: {
      userId: new Types.ObjectId(userId),
      ...(favorite && { favorite: true }),
      // Sin etiquetas: ausente, nulo o vacío.
      ...(untagged && { tags: { $in: [null, []] } }),
      // Etiqueta completa, sin distinguir mayúsculas.
      ...(tag && {
        tags: { $regex: `^${escapeRegex(tag)}$`, $options: "i" },
      }),
    },
  },
  {
    $lookup: {
      from: Book.collection.name,
      localField: "bookId",
      foreignField: "_id",
      as: "book",
    },
  },
  { $unwind: "$book" },
  ...(search ? buildSearchStages(search) : []),
];

const buildLibraryPipeline = (
  userId: string,
  { sort, cursor, ...filters }: LibraryPipelineOptions,
): PipelineStage[] => {
  const cursorId = cursor ? new Types.ObjectId(cursor.id) : undefined;
  const pipeline = buildFilteredLibraryStages(userId, filters);

  if (sort === "recent") {
    if (cursor && cursorId) {
      const createdAt = new Date(cursor.value);

      pipeline.push({
        $match: {
          $or: [
            { createdAt: { $lt: createdAt } },
            { createdAt, _id: { $lt: cursorId } },
          ],
        },
      });
    }

    pipeline.push({ $sort: { createdAt: -1, _id: -1 } });
  } else {
    if (cursor && cursorId) {
      pipeline.push({
        $match: {
          $or: [
            { "book.title": { $gt: cursor.value } },
            { "book.title": cursor.value, _id: { $gt: cursorId } },
          ],
        },
      });
    }

    pipeline.push({ $sort: { "book.title": 1, _id: 1 } });
  }

  pipeline.push({ $limit: LIBRARY_PAGE_SIZE + 1 });

  return pipeline;
};

const listLibrary = async (
  userId: string,
  query: unknown,
): Promise<LibraryPageDto> => {
  const {
    search,
    tag,
    untagged,
    favorite,
    sort,
    cursor: rawCursor,
  } = validateListLibraryQuery(query);
  const cursor = rawCursor ? decodeLibraryCursor(rawCursor, sort) : undefined;

  const filters = { search, tag, untagged, favorite };

  // La ordenación alfabética ignora mayúsculas y acentos (collation español).
  const [rows, totals] = await Promise.all([
    Ejemplar.aggregate<LibraryRow>(
      buildLibraryPipeline(userId, { sort, cursor, ...filters }),
    ).collation({ locale: "es", strength: 1 }),
    // El total ignora el cursor: cuenta todos los libros que cumplen los filtros.
    Ejemplar.aggregate<{ total: number }>([
      ...buildFilteredLibraryStages(userId, filters),
      { $count: "total" },
    ]),
  ]);

  const pageRows = rows.slice(0, LIBRARY_PAGE_SIZE);
  const lastRow = pageRows.at(-1);
  const hasMore = rows.length > LIBRARY_PAGE_SIZE;

  return {
    items: pageRows.map((row) => ({
      book: mapBookToDto(row.book),
      ejemplar: mapEjemplarToDto(row),
    })),
    nextCursor:
      hasMore && lastRow
        ? encodeLibraryCursor({
            sort,
            id: lastRow._id.toString(),
            value:
              sort === "recent"
                ? lastRow.createdAt.toISOString()
                : lastRow.book.title,
          })
        : null,
    total: totals[0]?.total ?? 0,
  };
};

// Etiquetas en uso con el número de libros de cada una. "Sci-Fi" y "sci-fi" son
// la misma etiqueta: se muestra la grafía más usada (la primera si empatan).
const listTags = async (userId: string): Promise<BookTagsDto> => {
  const ejemplares = await Ejemplar.find({ userId }, { tags: 1 }).lean();

  const groups = new Map<string, Map<string, number>>();
  let untaggedCount = 0;

  for (const { tags } of ejemplares) {
    if (!tags || tags.length === 0) {
      untaggedCount += 1;
    }

    for (const tag of tags ?? []) {
      const key = tag.toLocaleLowerCase("es");
      const spellings = groups.get(key) ?? new Map<string, number>();

      spellings.set(tag, (spellings.get(tag) ?? 0) + 1);
      groups.set(key, spellings);
    }
  }

  const collator = new Intl.Collator("es", { sensitivity: "base" });

  const items = [...groups.values()].map((spellings) => {
    const [tag] = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0];
    const count = [...spellings.values()].reduce((sum, uses) => sum + uses, 0);

    return { tag, count };
  });

  items.sort((a, b) => b.count - a.count || collator.compare(a.tag, b.tag));

  return { items, untaggedCount };
};

// Un id mal formado o de otro usuario es lo mismo para el cliente: ese libro no
// está en su biblioteca.
const getBook = async (
  userId: string,
  bookId: string,
): Promise<LibraryItemDto> => {
  if (!Types.ObjectId.isValid(bookId)) {
    throw BOOK_NOT_FOUND;
  }

  const ejemplar = await Ejemplar.findOne({ userId, bookId }).lean();
  const book = ejemplar ? await Book.findById(ejemplar.bookId).lean() : null;

  if (!ejemplar || !book) {
    throw BOOK_NOT_FOUND;
  }

  return { book: mapBookToDto(book), ejemplar: mapEjemplarToDto(ejemplar) };
};

const SCALAR_FIELDS = [
  "status",
  "location",
  "format",
  "provenance",
  "notes",
  "favorite",
] as const satisfies readonly (keyof UpdateEjemplarDto)[];

// `null` borra el campo ($unset); un valor lo guarda ($set). Los overrides se
// fusionan campo a campo con los que ya había.
const buildEjemplarUpdate = (dto: UpdateEjemplarDto) => {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};

  const assign = (path: string, value: unknown) => {
    if (value === null) {
      $unset[path] = 1;
    } else if (value !== undefined) {
      $set[path] = value;
    }
  };

  for (const key of SCALAR_FIELDS) {
    assign(key, dto[key]);
  }

  if (dto.acquisitionDate !== undefined) {
    assign(
      "acquisitionDate",
      dto.acquisitionDate && new Date(dto.acquisitionDate),
    );
  }

  if (dto.tags) {
    if (dto.tags.length > 0) {
      $set.tags = dto.tags;
    } else {
      $unset.tags = 1;
    }
  }

  for (const [key, value] of Object.entries(dto.overrides ?? {})) {
    assign(`overrides.${key}`, value);
  }

  return {
    ...(Object.keys($set).length > 0 && { $set }),
    ...(Object.keys($unset).length > 0 && { $unset }),
  };
};

// Nunca toca Libro: toda corrección va a Ejemplar.
const updateEjemplar = async (
  userId: string,
  bookId: string,
  body: unknown,
): Promise<EjemplarDto> => {
  if (!Types.ObjectId.isValid(bookId)) {
    throw BOOK_NOT_FOUND;
  }

  const dto = validateUpdateEjemplarDto(body);
  const update = buildEjemplarUpdate(dto);

  const ejemplar =
    Object.keys(update).length > 0
      ? await Ejemplar.findOneAndUpdate({ userId, bookId }, update, {
          new: true,
          runValidators: true,
        }).lean()
      : await Ejemplar.findOne({ userId, bookId }).lean();

  if (!ejemplar) {
    throw BOOK_NOT_FOUND;
  }

  return mapEjemplarToDto(ejemplar);
};

// Solo se elimina el Ejemplar del usuario (y sus citas): Libro es compartido y
// no se toca, aunque ya no lo tenga nadie.
const deleteBook = async (userId: string, bookId: string): Promise<void> => {
  if (!Types.ObjectId.isValid(bookId)) {
    throw BOOK_NOT_FOUND;
  }

  const deleted = await Ejemplar.findOneAndDelete({ userId, bookId }).lean();

  if (!deleted) {
    throw BOOK_NOT_FOUND;
  }

  await Quote.deleteMany({ ejemplarId: deleted._id });
};

const BooksService = {
  createBook,
  listLibrary,
  listTags,
  getBook,
  updateEjemplar,
  deleteBook,
};

export default BooksService;
