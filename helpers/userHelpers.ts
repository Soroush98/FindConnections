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
 * Updates a user's upload count
 * @param userId User ID
 * @param uploadCount New upload count
 * @param lastUploadDate Date of last upload
 * @returns Promise resolving when the API call completes
 */
export const updateUserUploadCount = async (
  userId: string, 
  uploadCount: number, 
  lastUploadDate: string
): Promise<Response> => {
  return fetch("/api/users/update-upload-count", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uploadCount, lastUploadDate }),
  });
};
