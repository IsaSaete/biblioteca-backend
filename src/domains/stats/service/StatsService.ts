import { Types } from "mongoose";
import Ejemplar from "../../books/model/Ejemplar.js";
import Quote from "../../quotes/model/Quote.js";
import type { StatsDto } from "../types/types.js";

// Cifras de Inicio. Las citas cuentan todas, también las que no tienen libro.
const getStats = async (userId: string): Promise<StatsDto> => {
  const owner = new Types.ObjectId(userId);

  const [books, quotes, favorites] = await Promise.all([
    Ejemplar.countDocuments({ userId: owner }),
    Quote.countDocuments({ userId: owner }),
    Ejemplar.countDocuments({ userId: owner, favorite: true }),
  ]);

  return { books, quotes, favorites };
};

const StatsService = { getStats };

export default StatsService;
