/**
 * Helper functions for file validation
 */

/**
 * Validates if a file is a valid image (PNG or JPEG) and within size limits
 * @param file The file to validate
 * @param maxSizeMB Maximum file size in MB (default: 5)
 * @returns Object containing validation result and error message if any
 */
export const validateImageFile = async (file: File, maxSizeMB = 5): Promise<{ isValid: boolean; message?: string }> => {
  // Check file size
  if (!file || file.size > maxSizeMB * 1024 * 1024) {
    return { isValid: false, message: `File size should be less than ${maxSizeMB} MB.` };
  }

  // Check file type by MIME type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, message: "Only PNG and JPEG files are allowed." };
  }

  // Additional validation by checking file signature/magic numbers
  try {
    const result = await validateImageSignature(file);
    if (!result.isValid) {
      return result;
    }
  } catch (error) {
    console.error("Error validating file signature:", error);
    return { isValid: false, message: "Error validating file. Please try again with a different file." };
  }

  return { isValid: true };
};

/**
 * Validates image file by checking its binary signature/magic numbers
 * @param file The file to validate
 * @returns Object containing validation result and error message if any
 */
export const validateImageSignature = async (file: File): Promise<{ isValid: boolean; message?: string }> => {
  return new Promise((resolve) => {
    const fileReader = new FileReader();
    
    fileReader.onloadend = () => {
      const arr = new Uint8Array(fileReader.result as ArrayBuffer).subarray(0, 4);
      let header = "";
      for (let i = 0; i < arr.length; i++) {
        header += arr[i].toString(16);
      }
      
      // Valid headers for PNG and JPEG formats
      const validHeaders = ["89504e47", "ffd8ffe0", "ffd8ffe1", "ffd8ffe2", "ffd8ffe3", "ffd8ffe8"];
      
      if (!validHeaders.includes(header)) {
        resolve({ isValid: false, message: "Only valid PNG and JPEG files are allowed." });
      } else {
        resolve({ isValid: true });
      }
    };
    
    fileReader.onerror = () => {
      resolve({ isValid: false, message: "Error reading file. Please try again." });
    };
    
    fileReader.readAsArrayBuffer(file);
  });
};
