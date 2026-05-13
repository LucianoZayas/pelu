import { safeParseNumber } from '@/../scripts/import-sheets/safe-parse';

describe('safeParseNumber', () => {
  test('number plano', () => expect(safeParseNumber(1500)).toBe(1500));
  test('number con decimales', () => expect(safeParseNumber(1234.56)).toBe(1234.56));
  test('cero', () => expect(safeParseNumber(0)).toBe(0));
  test('null', () => expect(safeParseNumber(null)).toBeNull());
  test('undefined', () => expect(safeParseNumber(undefined)).toBeNull());
  test('string vacío', () => expect(safeParseNumber('')).toBeNull());
  test('string "Adelanto"', () => expect(safeParseNumber('Adelanto')).toBeNull());
  test('string "NO INCLUYE"', () => expect(safeParseNumber('NO INCLUYE')).toBeNull());
  test('string "#REF!"', () => expect(safeParseNumber('#REF!')).toBeNull());
  test('string "#DIV/0!"', () => expect(safeParseNumber('#DIV/0!')).toBeNull());
  test('string "$1.500.000,50" (formato es-AR)', () => expect(safeParseNumber('$1.500.000,50')).toBe(1500000.5));
  test('string "1500"', () => expect(safeParseNumber('1500')).toBe(1500));
  test('formula con result', () => expect(safeParseNumber({ result: 1500, formula: '=A1+A2' } as never)).toBe(1500));
  test('formula con result null', () => expect(safeParseNumber({ result: null, formula: '=BAD()' } as never)).toBeNull());
  test('richText', () => expect(safeParseNumber({ richText: [{ text: '1500' }] } as never)).toBe(1500));
  test('Infinity', () => expect(safeParseNumber(Infinity)).toBeNull());
  test('NaN', () => expect(safeParseNumber(NaN)).toBeNull());
});
