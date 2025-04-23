const z = require('zod');

// User schemas
const userRegistrationSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(8),
  role: z.enum(['user', 'admin']).default('user')
});

const userLoginSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string()
});

// File transfer schemas
const fileMetaSchema = z.object({
  name: z.string().min(1),
  size: z.number().positive(),
  type: z.string().optional(),
  lastModified: z.number().optional()
});

const fileTransferRequestSchema = z.object({
  to: z.string().min(3).max(30),
  fileMeta: fileMetaSchema
});

const fileTransferResponseSchema = z.object({
  sessionId: z.string().uuid(),
  accept: z.boolean()
});

const fileTransferProgressSchema = z.object({
  sessionId: z.string().uuid(),
  progress: z.number().min(0).max(100)
});

/**
 * Validates data against a schema
 * @param {Object} schema - Zod schema
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result with success and error properties
 */
function validate(schema, data) {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    };
  }
}

module.exports = {
  validate,
  schemas: {
    userRegistrationSchema,
    userLoginSchema,
    fileMetaSchema,
    fileTransferRequestSchema,
    fileTransferResponseSchema,
    fileTransferProgressSchema
  }
};