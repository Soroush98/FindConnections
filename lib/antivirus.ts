import crypto from 'crypto';

export interface AntivirusResult {
  isClean: boolean;
  positives?: number;
  total?: number;
  message?: string;
}

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
      
      if (result.response_code === 1) {
        return {
          isClean: result.positives === 0,
          positives: result.positives,
          total: result.total,
          message: result.positives > 0 
            ? `File detected as malicious by ${result.positives} out of ${result.total} antivirus engines`
            : 'File is clean'
        };
      }
      
      return null; // File not found in database
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
      
      if (result.response_code === -2) {
        throw new Error('Scan is still in progress. Please wait and try again in a few minutes.');
      }
      
      if (result.response_code === 1) {
        return {
          isClean: result.positives === 0,
          positives: result.positives,
          total: result.total,
          message: result.positives > 0 
            ? `File detected as malicious by ${result.positives} out of ${result.total} antivirus engines`
            : 'File is clean'
        };
      }
      
      throw new Error('Scan completed with unexpected results');
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

      // Step 3: Wait for scan to process
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

      // Step 4: Get scan results
      const scanResult = await this.getScanResults(scanResource);
      
      return scanResult;
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
 * Factory function to create antivirus service instance
 */
export function createAntivirusService(): AntivirusService {
  return new AntivirusService();
}

/**
 * Utility function for simple file scanning
 */
export async function scanFileForViruses(buffer: Buffer): Promise<void> {
  const antivirusService = createAntivirusService();
  await antivirusService.validateFileIsSafe(buffer);
}
