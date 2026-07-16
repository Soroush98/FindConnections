/**
 * Helper functions for name validation.
 *
 * A valid full name is two or more space-separated parts, each made of unicode
 * letters, optionally joined internally by a hyphen or apostrophe. This admits
 * real-world names (Daniel Day-Lewis, Conan O'Brien, Penélope Cruz, three-part
 * names) while rejecting digits, symbols, control whitespace, and empty/oversized
 * input. Kept as the single source of truth — API routes import from here.
 */

/** Bounds on a full name, in characters. */
export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 60;

// A "part" is letters, optionally with internal hyphen/apostrophe-joined pieces.
// Parts are separated by a single ASCII space. `u` flag makes \p{L} match
// accented/unicode letters; the literal space forbids tabs/newlines.
const FULL_NAME_REGEX = /^\p{L}+(?:['-]\p{L}+)*(?: \p{L}+(?:['-]\p{L}+)*)+$/u;

/**
 * Validates if a full name string matches the required format.
 * @param fullName The full name to validate
 * @returns Boolean indicating if the name is valid
 */
export const isValidFullName = (fullName: string): boolean => {
  if (typeof fullName !== 'string') return false;
  if (fullName.length < NAME_MIN_LENGTH || fullName.length > NAME_MAX_LENGTH) {
    return false;
  }
  return FULL_NAME_REGEX.test(fullName);
};

/**
 * Validates if an input string contains only characters allowed while a user
 * is still typing a name (letters, spaces, hyphens, apostrophes).
 * @param input The character or string to validate
 * @returns Boolean indicating if the input contains only valid characters
 */
export const isValidNameInput = (input: string): boolean => {
  if (typeof input !== 'string') return false;
  if (input.length > NAME_MAX_LENGTH) return false;
  return /^[\p{L} '-]*$/u.test(input);
};

/**
 * Creates a handler function for input change events that enforces valid name characters
 * @param setter The state setter function to update with valid input
 * @returns Event handler function
 */
export const createNameChangeHandler = (
  setter: React.Dispatch<React.SetStateAction<string>>
) => (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  if (isValidNameInput(value)) {
    setter(value);
  } else {
    // Alert can be customized or replaced with a different notification method
    alert("Only letters, spaces, hyphens, and apostrophes are allowed.");
  }
};
