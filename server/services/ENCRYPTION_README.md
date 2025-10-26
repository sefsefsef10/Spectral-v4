# API Key Encryption Service

## Overview
This service provides HIPAA-compliant encryption for sensitive data (API keys, secrets) stored in the database using AES-256-GCM encryption.

## Setup

### 1. Generate Encryption Key
Run this command to generate a secure encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Set Environment Variable
Add the generated key to your secrets:
```bash
ENCRYPTION_KEY=<your-generated-key-from-step-1>
```

**IMPORTANT**: 
- Never commit this key to version control
- Store it securely in Replit Secrets or your environment
- If you lose this key, you cannot decrypt existing data

## Usage

### Encrypting Data
```typescript
import { encrypt, encryptFields } from './services/encryption';

// Encrypt a single value
const encryptedApiKey = encrypt('sk-1234567890abcdef');

// Encrypt specific fields in an object
const config = {
  apiKey: 'sk-1234567890abcdef',
  projectId: 'proj-123', // won't be encrypted
  secretKey: 'secret-xyz'
};

const encryptedConfig = encryptFields(config, ['apiKey', 'secretKey']);
// Result: { apiKey: 'encrypted:...', projectId: 'proj-123', secretKey: 'encrypted:...' }
```

### Decrypting Data
```typescript
import { decrypt, decryptFields } from './services/encryption';

// Decrypt a single value
const apiKey = decrypt('encrypted:iv:authTag:ciphertext');

// Decrypt specific fields in an object
const decryptedConfig = decryptFields(encryptedConfig, ['apiKey', 'secretKey']);
// Result: { apiKey: 'sk-1234567890abcdef', projectId: 'proj-123', secretKey: 'secret-xyz' }
```

### Example: Storing AI System Integration Config
```typescript
import { encryptFields, decryptFields } from './services/encryption';

// When creating/updating AI system with integration credentials
const integrationConfig = {
  provider: 'langsmith', // Not sensitive
  apiKey: 'ls-1234567890', // Sensitive - should be encrypted
  projectId: 'my-project', // Not sensitive
  webhookSecret: 'secret-abc' // Sensitive - should be encrypted
};

// Encrypt before storing
const encryptedConfig = encryptFields(integrationConfig, ['apiKey', 'webhookSecret']);
await storage.updateAISystem(aiSystemId, {
  integrationConfig: encryptedConfig
});

// Decrypt when reading
const aiSystem = await storage.getAISystem(aiSystemId);
if (aiSystem.integrationConfig) {
  const decryptedConfig = decryptFields(
    aiSystem.integrationConfig, 
    ['apiKey', 'webhookSecret']
  );
  // Use decryptedConfig.apiKey to make API calls
}
```

## Security Features

1. **AES-256-GCM**: Industry-standard authenticated encryption
2. **Unique IV per encryption**: Each encryption uses a fresh initialization vector
3. **Authentication tags**: Protects against tampering
4. **Backward compatible**: Detects unencrypted legacy data and handles gracefully
5. **HIPAA compliant**: Meets encryption requirements for protected health information

## Error Handling

The service will:
- Throw an error if `ENCRYPTION_KEY` is not set
- Throw an error if the key is the wrong length
- Log errors and throw on encryption/decryption failures
- Gracefully handle unencrypted legacy data (won't fail if field doesn't have 'encrypted:' prefix)

## Key Rotation (Advanced)

If you need to rotate your encryption key:
1. Generate a new key
2. Create a migration script that:
   - Reads all encrypted data with old key
   - Decrypts with old key
   - Re-encrypts with new key
   - Updates database
3. Update `ENCRYPTION_KEY` environment variable
4. Deploy the migration

**Note**: This is a complex operation. Contact your security team before attempting key rotation.
