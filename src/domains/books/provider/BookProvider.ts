import type { ExternalBookDto } from "../types/types.js";

// Catálogo externo de libros. Los servicios dependen de esta interfaz, no de un
// proveedor concreto: en los tests se sustituye por implementaciones falsas.
export interface BookProvider {
  readonly name: string;
  // `null` = el proveedor responde y no conoce el ISBN. Si falla, lanza BookProviderError.
  findByIsbn(isbn: string): Promise<ExternalBookDto | null>;
  // Lista vacía = sin resultados. Si falla, lanza BookProviderError.
  search(query: string, limit: number): Promise<ExternalBookDto[]>;
}

// El proveedor no respondió bien (timeout, error HTTP, respuesta ilegible).
export class BookProviderError extends Error {
  constructor(provider: string, reason: string) {
    super(`${provider}: ${reason}`);
    this.name = "BookProviderError";
  }
}
