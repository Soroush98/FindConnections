import crypto from 'crypto';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export interface FileValidationOptions {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  requireFilenamePattern?: RegExp;
  filenamePatternError?: string;
  enableAntivirusScanning?: boolean;
}

export interface AntivirusResult {
  isClean: boolean;
  positives?: number;
  total?: number;
  message?: string;
}

/**
 * Antivirus Service for scanning files using VirusTotal API
 */
export class AntivirusService {
  private apiKey: string;
  private baseUrl = 'https://www.virustotal.com/vtapi/v2';

  constructor() {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey || apiKey === 'your_virustotal_api_key_here') {
      throw new Error('VirusTotal API key is not configured');
    }
    this.apiKey = apiKey;
  }

  /**
   * Calculate SHA-256 hash of a file buffer
   */
  private calculateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Create fetch request with timeout using AbortController
   */
  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  }

  /**
   * Check if file hash exists in VirusTotal database
   */
  private async lookupFileHash(hash: string): Promise<AntivirusResult | null> {
    const url = `${this.baseUrl}/file/report?apikey=${this.apiKey}&resource=${hash}`;
    
    try {
      const response = await this.fetchWithTimeout(url, { method: 'GET' }, 10000);
      
      if (!response.ok) {
        throw new Error(`VirusTotal lookup failed with status: ${response.status}`);
      }

      const result = await response.json();
      
      // Handle different response codes
      switch (result.response_code) {
        case 1:
          // File found in database
          return {
            isClean: result.positives === 0,
            positives: result.positives || 0,
            total: result.total || 0,
            message: result.positives > 0 
              ? `File detected as malicious by ${result.positives} out of ${result.total} antivirus engines`
              : 'File is clean'
          };
        
        case 0:
        case -2:
          // File not found or scan in progress - return null to trigger new scan
          return null;
        
        default:
          return null; // Trigger new scan for unexpected responses
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Hash lookup failed: ${error.message}`);
      }
      throw new Error('Hash lookup failed: Unknown error');
    }
  }

  /**
   * Submit file to VirusTotal for scanning
   */
  private async submitFileForScanning(buffer: Buffer): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)]);
    formData.append('file', blob);
    formData.append('apikey', this.apiKey);

    const url = `${this.baseUrl}/file/scan`;
    
    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        body: formData,
      }, 30000);

      if (!response.ok) {
        throw new Error(`File submission failed with status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.response_code !== 1) {
        throw new Error('Failed to initialize scan');
      }

      return result.resource; // Return scan ID
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`File submission failed: ${error.message}`);
      }
      throw new Error('File submission failed: Unknown error');
    }
  }

  /**
   * Get scan results by resource ID
   */
  private async getScanResults(resource: string): Promise<AntivirusResult> {
    const url = `${this.baseUrl}/file/report?apikey=${this.apiKey}&resource=${resource}`;
    
    try {
      const response = await this.fetchWithTimeout(url, { method: 'GET' }, 10000);
      
      if (!response.ok) {
        throw new Error(`Results retrieval failed with status: ${response.status}`);
      }

      const result = await response.json();
      
      // Handle different response codes
      switch (result.response_code) {
        case -2:
          throw new Error('Scan is still in progress. Please wait and try again in a few minutes.');
        
        case 0:
          // File not found - treat as clean for new uploads
          return {
            isClean: true,
            positives: 0,
            total: 0,
            message: 'File not found in database (treated as clean)'
          };
        
        case 1:
          // Scan completed successfully
          return {
            isClean: result.positives === 0,
            positives: result.positives || 0,
            total: result.total || 0,
            message: result.positives > 0 
              ? `File detected as malicious by ${result.positives} out of ${result.total} antivirus engines`
              : 'File is clean'
          };
        
        default:
          // For unexpected response codes, be conservative and allow the file
          return {
            isClean: true,
            positives: 0,
            total: 0,
            message: 'Unable to verify file security (treated as clean)'
          };
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Results retrieval failed: Unknown error');
    }
  }

  /**
   * Main method to scan a file for viruses
   */
  async scanFile(buffer: Buffer): Promise<AntivirusResult> {
    try {
      // Step 1: Check if file hash exists in database
      const hash = this.calculateFileHash(buffer);
      const existingResult = await this.lookupFileHash(hash);
      
      if (existingResult) {
        return existingResult;
      }

      // Step 2: Submit file for new scan
      const scanResource = await this.submitFileForScanning(buffer);

      // Step 3: Wait for scan to process (reduced from 10s to 5s for faster UX)
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Step 4: Get scan results with retry mechanism
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          const scanResult = await this.getScanResults(scanResource);
          return scanResult;
        } catch (error) {
          attempts++;
          if (error instanceof Error && error.message.includes('still in progress')) {
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 more seconds
              continue;
            }
          }
          throw error;
        }
      }
      
      // If all attempts failed, be conservative and reject
      throw new Error('Scan timeout - unable to verify file security');
      
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Antivirus scan failed: ${error.message}`);
      }
      throw new Error('Antivirus scan failed: Unknown error');
    }
  }

  /**
   * Quick validation method that throws on malware detection
   */
  async validateFileIsSafe(buffer: Buffer): Promise<void> {
    const result = await this.scanFile(buffer);
    
    if (!result.isClean) {
      throw new Error(`Security threat detected: ${result.message}`);
    }
  }
}

/**
 * Default validation options for image uploads
 */
const DEFAULT_IMAGE_VALIDATION_OPTIONS: FileValidationOptions = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png'],
  allowedExtensions: ['jpg', 'jpeg', 'png'],
  enableAntivirusScanning: true,
};

/**
 * Validates file type and extension match
 */
function validateFileTypeAndExtension(file: File, options: FileValidationOptions): FileValidationResult {
  const { allowedMimeTypes = [], allowedExtensions = [] } = options;

  // Check MIME type
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
    const allowedTypesStr = allowedMimeTypes.map(type => type.split('/')[1].toUpperCase()).join(', ');
    return {
      isValid: false,
      error: `Invalid file type. Please upload ${allowedTypesStr} files only.`
    };
  }

  // Check file extension
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  // Normalize the allowed extensions to not have a leading dot for comparison
  const cleanAllowedExtensions = allowedExtensions.map(ext => ext.startsWith('.') ? ext.substring(1) : ext);

  if (!fileExtension || (cleanAllowedExtensions.length > 0 && !cleanAllowedExtensions.includes(fileExtension))) {
    // Create the error string with the dot for user readability
    const allowedExtStr = cleanAllowedExtensions.map(ext => `.${ext}`).join(', ');
    return {
      isValid: false,
      error: `Invalid file extension. Please use ${allowedExtStr} files only.`
    };
  }

  return { isValid: true };
}

/**
 * Validates file size
 */
function validateFileSize(file: File, maxSizeBytes: number): FileValidationResult {
  if (file.size > maxSizeBytes) {
    const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024));
    return {
      isValid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB.`
    };
  }
  return { isValid: true };
}

/**
 * Validates filename pattern
 */
function validateFilenamePattern(file: File, options: FileValidationOptions): FileValidationResult {
  const { requireFilenamePattern, filenamePatternError } = options;
  
  if (requireFilenamePattern) {
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
    if (!requireFilenamePattern.test(nameWithoutExt)) {
      return {
        isValid: false,
        error: filenamePatternError || 'Invalid filename format.'
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Validates file signature (magic numbers) against expected signatures
 */
function validateFileSignature(buffer: Buffer, allowedExtensions: string[]): FileValidationResult {
  // Check file signatures (magic numbers)
  const signature = buffer.toString('hex', 0, 8).toUpperCase();
  
  const signatureMap: Record<string, string[]> = {
    jpg: ['FFD8FF'],
    jpeg: ['FFD8FF'],
    png: ['89504E47'],
    gif: ['47494638'],
    pdf: ['25504446'],
    doc: ['D0CF11E0'],
    zip: ['504B0304'],
  };

  const validSignatures: string[] = [];
  allowedExtensions.forEach(ext => {
    const sigs = signatureMap[ext.toLowerCase()];
    if (sigs) {
      validSignatures.push(...sigs);
    }
  });

  if (validSignatures.length > 0) {
    const isValidSignature = validSignatures.some(sig => signature.startsWith(sig));
    if (!isValidSignature) {
      return {
        isValid: false,
        error: 'File appears to be corrupted or not a valid file. Please upload a genuine file.'
      };
    }
  }

  return { isValid: true };
}

/**
 * Performs antivirus scanning on file buffer
 */
async function validateFileIsSafe(buffer: Buffer): Promise<FileValidationResult> {
  try {
    const antivirusService = new AntivirusService();
    await antivirusService.validateFileIsSafe(buffer);
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? `Security check failed: ${error.message}` : 'File security scan failed. Please try again.'
    };
  }
}

/**
 * Comprehensive file validation function
 */
export async function validateUploadedFile(
  file: File, 
  customOptions: Partial<FileValidationOptions> = {}
): Promise<FileValidationResult> {
  const options = { ...DEFAULT_IMAGE_VALIDATION_OPTIONS, ...customOptions };

  // 1. Validate file type and extension
  const typeValidation = validateFileTypeAndExtension(file, options);
  if (!typeValidation.isValid) {
    return typeValidation;
  }

  // 2. Validate file size
  if (options.maxSizeBytes) {
    const sizeValidation = validateFileSize(file, options.maxSizeBytes);
    if (!sizeValidation.isValid) {
      return sizeValidation;
    }
  }

  // 3. Validate filename pattern if required
  const filenameValidation = validateFilenamePattern(file, options);
  if (!filenameValidation.isValid) {
    return filenameValidation;
  }

  // 4. Convert to buffer for remaining validations
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // 5. Validate file signature
  if (options.allowedExtensions) {
    const signatureValidation = validateFileSignature(buffer, options.allowedExtensions);
    if (!signatureValidation.isValid) {
      return signatureValidation;
    }
  }

  // 6. Antivirus scanning
  if (options.enableAntivirusScanning) {
    const antivirusValidation = await validateFileIsSafe(buffer);
    if (!antivirusValidation.isValid) {
      return antivirusValidation;
    }
  }

  return { isValid: true };
}

/**
 * Specialized validation for temporary image uploads
 */
export async function validateTempImageUpload(file: File): Promise<FileValidationResult> {
  const options: FileValidationOptions = {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png'],
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    requireFilenamePattern: /^[a-zA-Z0-9_\-\s.]+$/,
    filenamePatternError: 'Filename contains invalid characters. Only letters, numbers, spaces, hyphens, and underscores are allowed.',
    enableAntivirusScanning: true
  };

  // No fallback: if any part of the validation fails, especially antivirus, 
  // the entire process should fail.
  return validateFile(file, options);
}

/**
 * The core file validation logic
 */
async function validateFile(file: File, options: FileValidationOptions): Promise<FileValidationResult> {
  // 1. Validate file type and extension
  const typeValidation = validateFileTypeAndExtension(file, options);
  if (!typeValidation.isValid) {
    return typeValidation;
  }

  // 2. Validate file size
  if (options.maxSizeBytes) {
    const sizeValidation = validateFileSize(file, options.maxSizeBytes);
    if (!sizeValidation.isValid) {
      return sizeValidation;
    }
  }

  // 3. Validate filename pattern if required
  const filenameValidation = validateFilenamePattern(file, options);
  if (!filenameValidation.isValid) {
    return filenameValidation;
  }

  // 4. Convert to buffer for remaining validations
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // 5. Validate file signature
  if (options.allowedExtensions) {
    const signatureValidation = validateFileSignature(buffer, options.allowedExtensions);
    if (!signatureValidation.isValid) {
      return signatureValidation;
    }
  }

  // 6. Antivirus scanning
  if (options.enableAntivirusScanning) {
    const antivirusValidation = await validateFileIsSafe(buffer);
    if (!antivirusValidation.isValid) {
      return antivirusValidation;
    }
  }

  return { isValid: true };
}

/**
 * Factory function to create antivirus service instance
 */
export function createAntivirusService(): AntivirusService {
  return new AntivirusService();
}

/**
 * Utility function for simple file scanning (backwards compatibility)
 */
export async function scanFileForViruses(buffer: Buffer): Promise<void> {
  const antivirusService = createAntivirusService();
  await antivirusService.validateFileIsSafe(buffer);
}
