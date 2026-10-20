const ISBN_10_PATTERN = /^\d{9}[\dX]$/;
const ISBN_13_PATTERN = /^(978|979)\d{10}$/;

const isIsbn10Valid = (isbn: string): boolean => {
  const sum = [...isbn].reduce((total, character, index) => {
    const value = character === "X" ? 10 : Number(character);

    return total + value * (10 - index);
  }, 0);

  return sum % 11 === 0;
};

// Dígito de control de un ISBN-13: pesos alternos 1 y 3 sobre los 12 primeros.
const calculateIsbn13CheckDigit = (firstTwelveDigits: string): number => {
  const sum = [...firstTwelveDigits].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  );

  return (10 - (sum % 10)) % 10;
};

// Normaliza (sin guiones ni espacios) y valida el dígito de control. Devuelve
// siempre el ISBN-13 —convirtiendo desde ISBN-10 si hace falta— o `null` si el
// formato o el dígito de control no son válidos.
const toIsbn13 = (rawIsbn: string): string | null => {
  const isbn = rawIsbn.replace(/[\s-]/g, "").toUpperCase();

  if (ISBN_10_PATTERN.test(isbn)) {
    if (!isIsbn10Valid(isbn)) {
      return null;
    }

    const firstTwelveDigits = `978${isbn.slice(0, 9)}`;

    return `${firstTwelveDigits}${calculateIsbn13CheckDigit(firstTwelveDigits)}`;
  }

  if (ISBN_13_PATTERN.test(isbn)) {
    const checkDigit = calculateIsbn13CheckDigit(isbn.slice(0, 12));

    return checkDigit === Number(isbn[12]) ? isbn : null;
  }

  return null;
};

export default toIsbn13;
