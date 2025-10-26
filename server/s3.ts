import { logger } from "./logger";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// AWS S3 client for storing compliance reports and evidence
// Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_S3_BUCKET in environment
let s3Client: S3Client | null = null;
let s3Bucket: string | null = null;

if (
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_REGION &&
  process.env.AWS_S3_BUCKET
) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  s3Bucket = process.env.AWS_S3_BUCKET;
  logger.info({ bucket: s3Bucket }, 'S3 storage initialized');
} else {
  logger.warn("S3 storage disabled (no credentials) - using local filesystem");
}

export class S3Service {
  /**
   * Upload a file to S3
   * @param key - S3 object key (path/filename.pdf)
   * @param body - File content (Buffer or string)
   * @param contentType - MIME type
   * @returns S3 URL
   */
  static async upload(key: string, body: Buffer | string, contentType: string): Promise<string | null> {
    if (!s3Client || !s3Bucket) {
      logger.warn("S3 not configured - skipping upload");
      return null;
    }

    try {
      const command = new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256', // HIPAA-compliant encryption at rest
      });

      await s3Client.send(command);
      
      // Return the S3 URL (not publicly accessible - use getSignedUrl for access)
      return `s3://${s3Bucket}/${key}`;
    } catch (error) {
      logger.error({ err: error }, "S3 upload error");
      return null;
    }
  }

  /**
   * Generate a signed URL for downloading a file from S3
   * @param key - S3 object key
   * @param expiresIn - URL expiration in seconds (default: 1 hour)
   * @returns Signed URL that expires
   */
  static async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
    if (!s3Client || !s3Bucket) {
      logger.warn("S3 not configured - cannot generate signed URL");
      return null;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: s3Bucket,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      logger.error({ err: error }, "S3 getSignedUrl error");
      return null;
    }
  }

  /**
   * Check if a file exists in S3
   * @param key - S3 object key
   * @returns true if exists, false otherwise
   */
  static async fileExists(key: string): Promise<boolean> {
    if (!s3Client || !s3Bucket) return false;

    try {
      const command = new HeadObjectCommand({
        Bucket: s3Bucket,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate S3 key for compliance report
   * @param healthSystemId - Health system ID
   * @param reportType - Type of report
   * @param reportId - Report ID
   * @returns S3 key
   */
  static getReportKey(healthSystemId: string, reportType: string, reportId: string): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `reports/${healthSystemId}/${reportType}/${timestamp}/${reportId}.pdf`;
  }

  /**
   * Generate S3 key for certification evidence
   * @param vendorId - Vendor ID
   * @param certificationId - Certification ID
   * @param fileName - Original filename
   * @returns S3 key
   */
  static getCertificationKey(vendorId: string, certificationId: string, fileName: string): string {
    return `certifications/${vendorId}/${certificationId}/${fileName}`;
  }

  /**
   * Generate S3 key for audit evidence
   * @param healthSystemId - Health system ID
   * @param evidenceType - Type of evidence
   * @param fileName - Original filename
   * @returns S3 key
   */
  static getAuditEvidenceKey(healthSystemId: string, evidenceType: string, fileName: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return `audit-evidence/${healthSystemId}/${evidenceType}/${timestamp}/${fileName}`;
  }

  /**
   * Extract S3 key from S3 URL
   * @param s3Url - S3 URL (s3://bucket/key)
   * @returns S3 key or null
   */
  static extractKeyFromUrl(s3Url: string): string | null {
    if (!s3Url.startsWith('s3://')) return null;
    
    const parts = s3Url.replace('s3://', '').split('/');
    parts.shift(); // Remove bucket name
    return parts.join('/');
  }
}
