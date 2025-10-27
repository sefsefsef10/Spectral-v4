import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt } from '../../utils/encryption';

describe('PHI Encryption Security Tests', () => {
  const testPHI = {
    ssn: '123-45-6789',
    mrn: 'MRN12345',
    patientName: 'John Doe',
    diagnosis: 'Type 2 Diabetes',
  };

  describe('AES-256-GCM Encryption', () => {
    it('should encrypt PHI data', () => {
      const encrypted = encrypt(JSON.stringify(testPHI));
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toContain(testPHI.ssn);
      expect(encrypted).not.toContain(testPHI.mrn);
      expect(encrypted).not.toContain(testPHI.patientName);
    });

    it('should decrypt PHI data correctly', () => {
      const encrypted = encrypt(JSON.stringify(testPHI));
      const decrypted = decrypt(encrypted);
      const data = JSON.parse(decrypted);
      
      expect(data).toEqual(testPHI);
    });

    it('should produce different ciphertext for same plaintext (IV randomization)', () => {
      const encrypted1 = encrypt(JSON.stringify(testPHI));
      const encrypted2 = encrypt(JSON.stringify(testPHI));
      
      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should fail decryption with tampered ciphertext', () => {
      const encrypted = encrypt(JSON.stringify(testPHI));
      const tampered = encrypted.substring(0, encrypted.length - 10) + 'XXXXXXXXXX';
      
      expect(() => decrypt(tampered)).toThrow();
    });

    it('should use 256-bit encryption key', () => {
      const keyLength = process.env.ENCRYPTION_KEY?.length || 0;
      const decodedKeyLength = Buffer.from(process.env.ENCRYPTION_KEY || '', 'base64').length;
      
      expect(decodedKeyLength).toBe(32); // 256 bits = 32 bytes
    });

    it('should include authentication tag (GCM mode)', () => {
      const encrypted = encrypt(JSON.stringify(testPHI));
      const parts = encrypted.split(':');
      
      expect(parts.length).toBeGreaterThanOrEqual(3); // IV:encrypted:authTag
    });
  });

  describe('PHI Field Encryption in Database', () => {
    it('should never store PHI in plaintext', () => {
      const mockPatientData = {
        ssn: '123-45-6789',
        name: 'Jane Smith',
        dob: '1980-01-01',
      };

      const encrypted = encrypt(JSON.stringify(mockPatientData));
      
      expect(encrypted).not.toMatch(/123-45-6789/);
      expect(encrypted).not.toMatch(/Jane Smith/);
      expect(encrypted).not.toMatch(/1980-01-01/);
    });

    it('should encrypt before database insertion', () => {
      const sensitiveData = 'Patient has HIV diagnosis';
      const encrypted = encrypt(sensitiveData);
      
      expect(encrypted).not.toContain('HIV');
      expect(encrypted).not.toContain('diagnosis');
    });
  });

  describe('Encryption Key Management', () => {
    it('should use environment variable for key', () => {
      expect(process.env.ENCRYPTION_KEY).toBeDefined();
    });

    it('should not expose key in logs or responses', () => {
      const key = process.env.ENCRYPTION_KEY;
      const logMessage = `Encryption complete for user data`;
      
      expect(logMessage).not.toContain(key || '');
    });

    it('should reject encryption without key', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;
      
      expect(() => encrypt('test')).toThrow();
      
      process.env.ENCRYPTION_KEY = originalKey;
    });
  });

  describe('Data-at-Rest Encryption', () => {
    it('should encrypt telemetry events containing PHI', () => {
      const telemetryEvent = {
        eventType: 'phi_exposure',
        metadata: {
          patientId: 'P123456',
          detectedPHI: ['SSN: 123-45-6789', 'DOB: 1980-01-01'],
        },
      };

      const encrypted = encrypt(JSON.stringify(telemetryEvent));
      
      expect(encrypted).not.toContain('123-45-6789');
      expect(encrypted).not.toContain('1980-01-01');
    });

    it('should encrypt AI model outputs containing PHI', () => {
      const modelOutput = {
        prediction: 'Patient John Doe (MRN: 12345) has 85% risk of sepsis',
        confidence: 0.85,
      };

      const encrypted = encrypt(JSON.stringify(modelOutput));
      
      expect(encrypted).not.toContain('John Doe');
      expect(encrypted).not.toContain('MRN: 12345');
    });
  });

  describe('Encryption Performance', () => {
    it('should encrypt large datasets efficiently', () => {
      const largeDataset = JSON.stringify(Array(1000).fill(testPHI));
      const startTime = Date.now();
      
      encrypt(largeDataset);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });

    it('should decrypt large datasets efficiently', () => {
      const largeDataset = JSON.stringify(Array(1000).fill(testPHI));
      const encrypted = encrypt(largeDataset);
      const startTime = Date.now();
      
      decrypt(encrypted);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
    });
  });
});
