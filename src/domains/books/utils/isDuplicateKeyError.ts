const MONGO_DUPLICATE_KEY_ERROR = 11000;

// Un índice único rechazó la escritura (por ejemplo, otra petición creó antes
// el mismo ISBN).
const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === MONGO_DUPLICATE_KEY_ERROR;

export default isDuplicateKeyError;
