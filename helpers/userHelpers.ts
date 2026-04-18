/**
 * Helper functions for user-related operations
 */

/**
 * Validates if a password meets strength requirements
 * @param password The password to validate
 * @returns Boolean indicating if the password is strong enough
 */
export const isStrongPassword = (password: string): boolean => {
  const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return pattern.test(password);
};

/**
 * Validates email format
 * @param email The email to validate
 * @returns Boolean indicating if the email is valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Asks the server to refresh the authenticated user's daily upload quota.
 * The server derives the new count and date — the client cannot set them.
 */
export const refreshDailyUploadCount = async (): Promise<Response> => {
  return fetch("/api/users/update-upload-count", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
};
