/**
 * TC-NAME — name validation helpers (traces: R5, R7; fixes DEF-004, DEF-006).
 * Techniques: equivalence partitioning (valid / invalid classes) and
 * boundary-value analysis on word count, separators, and length.
 */
import { describe, it, expect } from 'vitest';
import { isValidFullName, isValidNameInput, NAME_MAX_LENGTH } from '@/helpers/nameValidation';

describe('isValidFullName — valid partition (TC-NAME-001)', () => {
  it.each([
    'John Doe',
    'ada Lovelace',
    'A B',
    'John Ronald Tolkien', // three parts
    'Daniel Day-Lewis', // hyphen (DEF-004)
    "Conan O'Brien", // apostrophe (DEF-004)
    'Penélope Cruz', // accented letters (DEF-004)
    'Beyoncé Knowles',
    'Mary-Kate Olsen',
    'Jean-Claude Van Damme',
  ])('accepts "%s"', (name) => {
    expect(isValidFullName(name)).toBe(true);
  });
});

describe('isValidFullName — invalid partitions (TC-NAME-002)', () => {
  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['single word', 'Prince'],
    ['digit in name', 'John Do3'],
    ['double space between words', 'John  Doe'],
    ['leading space', ' John Doe'],
    ['trailing space', 'John Doe '],
    ['tab separator (DEF-006)', 'John\tDoe'],
    ['newline separator (DEF-006)', 'John\nDoe'],
    ['script injection', '<script>alert(1)</script>'],
    ['emoji', 'John 💥Doe'],
    ['under min length', 'A'],
  ])('rejects %s', (_label, name) => {
    expect(isValidFullName(name)).toBe(false);
  });

  it('rejects an oversized name at the boundary (DEF-006, BVA)', () => {
    const maxOk = `${'a'.repeat(NAME_MAX_LENGTH - 2)} b`; // exactly NAME_MAX_LENGTH
    expect(maxOk.length).toBe(NAME_MAX_LENGTH);
    expect(isValidFullName(maxOk)).toBe(true);

    const tooLong = `${'a'.repeat(NAME_MAX_LENGTH - 1)} b`; // NAME_MAX_LENGTH + 1
    expect(tooLong.length).toBe(NAME_MAX_LENGTH + 1);
    expect(isValidFullName(tooLong)).toBe(false);

    expect(isValidFullName(`${'a'.repeat(5000)} ${'b'.repeat(5000)}`)).toBe(false);
  });
});

describe('isValidNameInput (TC-NAME-003)', () => {
  it.each(['', 'John', 'John Doe', 'John  ', 'Mary-Kate', "O'Brien", 'Penélope'])(
    'accepts partial input "%s"',
    (input) => {
      expect(isValidNameInput(input)).toBe(true);
    }
  );

  it.each([
    ['digits', 'John3'],
    ['punctuation', 'John.'],
    ['emoji', 'John💥'],
    ['angle brackets', '<b>'],
    ['tab', 'John\tDoe'],
    ['over max length', 'a'.repeat(NAME_MAX_LENGTH + 1)],
  ])('rejects %s', (_label, input) => {
    expect(isValidNameInput(input)).toBe(false);
  });
});
