/**
 * Helper functions for name validation
 */

/**
 * Validates if a full name string matches required format (firstname lastname)
 * @param fullName The full name to validate
 * @returns Boolean indicating if the name is valid
 */
export const isValidFullName = (fullName: string): boolean => {
  if (!fullName || !fullName.trim()) {
    return false;
  }
  
  const nameRegex = /^[a-zA-Z]+\s[a-zA-Z]+$/;
  return nameRegex.test(fullName);
};

/**
 * Validates if an input character is valid for a name (alphabetic or space)
 * @param input The character or string to validate
 * @returns Boolean indicating if the input contains only valid characters
 */
export const isValidNameInput = (input: string): boolean => {
  const nameRegex = /^[a-zA-Z\s]*$/;
  return nameRegex.test(input);
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
    alert("Only alphabetic characters and spaces are allowed.");
  }
};
