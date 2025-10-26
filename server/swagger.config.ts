import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Spectral Healthcare AI Governance Platform API',
      version: '1.0.0',
      description: `
        Enterprise-grade B2B SaaS platform for healthcare AI governance, monitoring, and compliance.
        
        ## Features
        
        - **AI Inventory Management** - Track and manage AI systems across healthcare organizations
        - **Real-Time Monitoring** - Alert management with predictive analytics
        - **Compliance Frameworks** - HIPAA, NIST AI RMF, FDA SaMD, ISO 42001, and more
        - **Vendor Certification** - Automated certification workflow with PHI detection, bias testing, and threat modeling
        - **Audit Logging** - Comprehensive activity tracking for regulatory compliance
        - **Billing & Subscriptions** - Usage-based metering and automated invoicing
        - **WebSocket Real-Time Updates** - Live dashboard updates for alerts and compliance changes
        
        ## Authentication
        
        All protected endpoints require session-based authentication. Users must first authenticate via \`/api/auth/login\` 
        which sets a secure HTTP-only session cookie. Subsequent requests automatically include this cookie.
        
        ## Multi-Tenant Architecture
        
        The platform enforces strict tenant isolation with role-based access control (RBAC):
        - **Health Systems** - Manage AI portfolios, monitor compliance, review vendor certifications
        - **AI Vendors** - Submit for certification, access trust page, view customer insights
        
        All tenant-specific endpoints verify ownership and return 404 for unauthorized access (not 403) 
        to prevent enumeration attacks.
        
        ## Rate Limiting
        
        - Authentication endpoints: 5 requests / 15 minutes
        - General API endpoints: 100 requests / 15 minutes  
        - Webhooks: 100 requests / 15 minutes
        - MFA endpoints: 10 requests / 15 minutes
      `,
      contact: {
        name: 'Spectral API Support',
        email: 'api@spectral-health.ai',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.spectral-health.ai' 
          : 'http://localhost:5000',
        description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'spectral.sid',
          description: 'Session cookie set after successful authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['health_system', 'vendor', 'admin'] },
            healthSystemId: { type: 'string', nullable: true },
            vendorId: { type: 'string', nullable: true },
            mfaEnabled: { type: 'boolean' },
          },
        },
        AISystem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            department: { type: 'string' },
            riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            status: { type: 'string', enum: ['active', 'monitoring', 'incident', 'deactivated'] },
            healthSystemId: { type: 'string' },
            vendorId: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Alert: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            systemId: { type: 'string' },
            severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            type: { type: 'string' },
            message: { type: 'string' },
            status: { type: 'string', enum: ['active', 'investigating', 'resolved', 'acknowledged'] },
            createdAt: { type: 'string', format: 'date-time' },
            resolvedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        ComplianceControl: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            controlId: { type: 'string' },
            framework: { type: 'string', enum: ['HIPAA', 'NIST_AI_RMF', 'FDA_SAMD', 'ISO_27001', 'ISO_42001'] },
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication and session management' },
      { name: 'Users', description: 'User management and invitations' },
      { name: 'AI Systems', description: 'AI system inventory and management' },
      { name: 'Alerts', description: 'Real-time monitoring and alerting' },
      { name: 'Compliance', description: 'Compliance frameworks and mappings' },
      { name: 'Vendors', description: 'AI vendor directory and management' },
      { name: 'Certifications', description: 'Vendor certification workflow' },
      { name: 'Billing', description: 'Subscription and usage-based billing' },
      { name: 'Webhooks', description: 'External integration webhooks' },
      { name: 'Audit Logs', description: 'Activity tracking and audit trails' },
    ],
  },
  apis: ['./server/routes.ts'], // Path to the API routes file
};

export const swaggerSpec = swaggerJsdoc(options);
