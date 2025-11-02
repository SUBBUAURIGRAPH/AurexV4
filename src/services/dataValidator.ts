/**
 * Data Validator Service
 * Validates data before syncing to ensure data integrity
 * Supports schema validation, custom rules, and data sanitization
 * @version 1.0.0
 */

export interface ValidationRule {
  field: string;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'email' | 'url';
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean | Promise<boolean>;
  customMessage?: string;
  allowNull?: boolean;
  enum?: unknown[];
}

export interface ValidationSchema {
  required?: string[];
  types?: Record<string, string>;
  rules?: ValidationRule[];
  strict?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
  rule?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  validatedData?: unknown;
  fieldErrors?: ValidationError[];
}

export interface DataValidatorConfig {
  strictMode: boolean;
  sanitizeData: boolean;
  allowUnknownFields: boolean;
  coerceTypes: boolean;
  maxDepth: number;
  enableWarnings: boolean;
}

/**
 * Comprehensive data validation service
 */
export class DataValidator {
  private config: DataValidatorConfig;
  private customValidators: Map<string, (value: unknown) => boolean | Promise<boolean>>;

  constructor(config?: Partial<DataValidatorConfig>) {
    this.config = {
      strictMode: config?.strictMode ?? true,
      sanitizeData: config?.sanitizeData ?? true,
      allowUnknownFields: config?.allowUnknownFields ?? false,
      coerceTypes: config?.coerceTypes ?? false,
      maxDepth: config?.maxDepth ?? 10,
      enableWarnings: config?.enableWarnings ?? true,
    };

    this.customValidators = new Map();
    this.registerDefaultValidators();
  }

  /**
   * Validate data against schema
   */
  async validate(data: unknown, schema: ValidationSchema): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldErrors: ValidationError[] = [];

    // Check if data is an object
    if (!this.isObject(data)) {
      return {
        valid: false,
        errors: ['Data must be an object'],
        warnings,
      };
    }

    // Validate required fields
    if (schema.required && schema.required.length > 0) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`Required field "${field}" is missing`);
          fieldErrors.push({
            field,
            message: 'Field is required',
            rule: 'required',
          });
        }
      }
    }

    // Validate types
    if (schema.types) {
      for (const [field, expectedType] of Object.entries(schema.types)) {
        if (field in data) {
          const value = (data as Record<string, unknown>)[field];
          const typeValid = this.validateType(value, expectedType);

          if (!typeValid) {
            errors.push(`Field "${field}" must be of type ${expectedType}`);
            fieldErrors.push({
              field,
              message: `Expected type ${expectedType}`,
              value,
              rule: 'type',
            });
          }
        }
      }
    }

    // Validate custom rules
    if (schema.rules && schema.rules.length > 0) {
      for (const rule of schema.rules) {
        const value = (data as Record<string, unknown>)[rule.field];
        const ruleResult = await this.validateRule(value, rule);

        if (!ruleResult.valid) {
          errors.push(...ruleResult.errors);
          fieldErrors.push(...ruleResult.fieldErrors);
        }

        if (ruleResult.warnings && ruleResult.warnings.length > 0) {
          warnings.push(...ruleResult.warnings);
        }
      }
    }

    // Check for unknown fields in strict mode
    if (schema.strict && !this.config.allowUnknownFields) {
      const knownFields = new Set<string>();

      if (schema.required) {
        schema.required.forEach(field => knownFields.add(field));
      }

      if (schema.types) {
        Object.keys(schema.types).forEach(field => knownFields.add(field));
      }

      if (schema.rules) {
        schema.rules.forEach(rule => knownFields.add(rule.field));
      }

      const dataFields = Object.keys(data);
      const unknownFields = dataFields.filter(field => !knownFields.has(field));

      if (unknownFields.length > 0) {
        if (this.config.strictMode) {
          errors.push(`Unknown fields: ${unknownFields.join(', ')}`);
        } else if (this.config.enableWarnings) {
          warnings.push(`Unknown fields detected: ${unknownFields.join(', ')}`);
        }
      }
    }

    // Sanitize data if enabled
    let validatedData = data;
    if (this.config.sanitizeData && errors.length === 0) {
      validatedData = this.sanitize(data, schema);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validatedData,
      fieldErrors: fieldErrors.length > 0 ? fieldErrors : undefined,
    };
  }

  /**
   * Validate a single value against a rule
   */
  async validateRule(value: unknown, rule: ValidationRule): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    fieldErrors: ValidationError[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldErrors: ValidationError[] = [];

    // Check if field is required
    if (rule.required && (value === undefined || value === null)) {
      if (!rule.allowNull || value === undefined) {
        errors.push(`Field "${rule.field}" is required`);
        fieldErrors.push({
          field: rule.field,
          message: 'Field is required',
          value,
          rule: 'required',
        });
        return { valid: false, errors, warnings, fieldErrors };
      }
    }

    // Skip further validation if value is null and allowed
    if (value === null && rule.allowNull) {
      return { valid: true, errors, warnings, fieldErrors };
    }

    // Validate type
    if (rule.type) {
      const typeValid = this.validateType(value, rule.type);
      if (!typeValid) {
        errors.push(`Field "${rule.field}" must be of type ${rule.type}`);
        fieldErrors.push({
          field: rule.field,
          message: `Expected type ${rule.type}`,
          value,
          rule: 'type',
        });
        return { valid: false, errors, warnings, fieldErrors };
      }
    }

    // Validate enum
    if (rule.enum && rule.enum.length > 0) {
      const enumValid = rule.enum.includes(value);
      if (!enumValid) {
        errors.push(`Field "${rule.field}" must be one of: ${rule.enum.join(', ')}`);
        fieldErrors.push({
          field: rule.field,
          message: `Must be one of: ${rule.enum.join(', ')}`,
          value,
          rule: 'enum',
        });
      }
    }

    // Validate min/max for numbers
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`Field "${rule.field}" must be >= ${rule.min}`);
        fieldErrors.push({
          field: rule.field,
          message: `Must be >= ${rule.min}`,
          value,
          rule: 'min',
        });
      }

      if (rule.max !== undefined && value > rule.max) {
        errors.push(`Field "${rule.field}" must be <= ${rule.max}`);
        fieldErrors.push({
          field: rule.field,
          message: `Must be <= ${rule.max}`,
          value,
          rule: 'max',
        });
      }
    }

    // Validate minLength/maxLength for strings and arrays
    if (typeof value === 'string' || Array.isArray(value)) {
      const length = Array.isArray(value) ? value.length : value.length;

      if (rule.minLength !== undefined && length < rule.minLength) {
        errors.push(`Field "${rule.field}" must have length >= ${rule.minLength}`);
        fieldErrors.push({
          field: rule.field,
          message: `Must have length >= ${rule.minLength}`,
          value,
          rule: 'minLength',
        });
      }

      if (rule.maxLength !== undefined && length > rule.maxLength) {
        errors.push(`Field "${rule.field}" must have length <= ${rule.maxLength}`);
        fieldErrors.push({
          field: rule.field,
          message: `Must have length <= ${rule.maxLength}`,
          value,
          rule: 'maxLength',
        });
      }
    }

    // Validate pattern for strings
    if (rule.pattern && typeof value === 'string') {
      if (!rule.pattern.test(value)) {
        errors.push(`Field "${rule.field}" does not match required pattern`);
        fieldErrors.push({
          field: rule.field,
          message: rule.customMessage ?? 'Does not match required pattern',
          value,
          rule: 'pattern',
        });
      }
    }

    // Custom validation
    if (rule.custom) {
      try {
        const customValid = await rule.custom(value);
        if (!customValid) {
          errors.push(rule.customMessage ?? `Field "${rule.field}" failed custom validation`);
          fieldErrors.push({
            field: rule.field,
            message: rule.customMessage ?? 'Failed custom validation',
            value,
            rule: 'custom',
          });
        }
      } catch (error) {
        errors.push(`Custom validation error for field "${rule.field}": ${error}`);
        fieldErrors.push({
          field: rule.field,
          message: `Custom validation error: ${error}`,
          value,
          rule: 'custom',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fieldErrors,
    };
  }

  /**
   * Validate data type
   */
  validateType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';

      case 'number':
        return typeof value === 'number' && !isNaN(value);

      case 'boolean':
        return typeof value === 'boolean';

      case 'object':
        return this.isObject(value);

      case 'array':
        return Array.isArray(value);

      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value as string));

      case 'email':
        return typeof value === 'string' && this.isValidEmail(value);

      case 'url':
        return typeof value === 'string' && this.isValidUrl(value);

      default:
        return false;
    }
  }

  /**
   * Sanitize data
   */
  sanitize(data: unknown, schema: ValidationSchema): unknown {
    if (!this.isObject(data)) {
      return data;
    }

    const sanitized: Record<string, unknown> = {};

    // Only include known fields
    const knownFields = new Set<string>();

    if (schema.required) {
      schema.required.forEach(field => knownFields.add(field));
    }

    if (schema.types) {
      Object.keys(schema.types).forEach(field => knownFields.add(field));
    }

    if (schema.rules) {
      schema.rules.forEach(rule => knownFields.add(rule.field));
    }

    for (const field of knownFields) {
      if (field in data) {
        let value = (data as Record<string, unknown>)[field];

        // Type coercion if enabled
        if (this.config.coerceTypes && schema.types && schema.types[field]) {
          value = this.coerceType(value, schema.types[field]);
        }

        // Sanitize strings
        if (typeof value === 'string') {
          value = this.sanitizeString(value);
        }

        sanitized[field] = value;
      }
    }

    return sanitized;
  }

  /**
   * Register custom validator
   */
  registerValidator(
    name: string,
    validator: (value: unknown) => boolean | Promise<boolean>
  ): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Get custom validator
   */
  getValidator(name: string): ((value: unknown) => boolean | Promise<boolean>) | undefined {
    return this.customValidators.get(name);
  }

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate nested object
   */
  async validateNested(
    data: unknown,
    schema: ValidationSchema,
    depth: number = 0
  ): Promise<ValidationResult> {
    if (depth > this.config.maxDepth) {
      return {
        valid: false,
        errors: ['Maximum nesting depth exceeded'],
        warnings: [],
      };
    }

    return this.validate(data, schema);
  }

  /**
   * Batch validate multiple items
   */
  async validateBatch(
    items: unknown[],
    schema: ValidationSchema
  ): Promise<ValidationResult[]> {
    return Promise.all(items.map(item => this.validate(item, schema)));
  }

  // Private helper methods

  private registerDefaultValidators(): void {
    // Register common validators
    this.registerValidator('positive', (value: unknown) => {
      return typeof value === 'number' && value > 0;
    });

    this.registerValidator('negative', (value: unknown) => {
      return typeof value === 'number' && value < 0;
    });

    this.registerValidator('alphanumeric', (value: unknown) => {
      return typeof value === 'string' && /^[a-zA-Z0-9]+$/.test(value);
    });

    this.registerValidator('uuid', (value: unknown) => {
      return (
        typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      );
    });

    this.registerValidator('json', (value: unknown) => {
      if (typeof value !== 'string') return false;
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    });

    this.registerValidator('iso8601', (value: unknown) => {
      if (typeof value !== 'string') return false;
      return !isNaN(Date.parse(value));
    });

    this.registerValidator('notEmpty', (value: unknown) => {
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      if (this.isObject(value)) return Object.keys(value).length > 0;
      return value !== null && value !== undefined;
    });
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private sanitizeString(str: string): string {
    // Remove leading/trailing whitespace
    let sanitized = str.trim();

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  private coerceType(value: unknown, targetType: string): unknown {
    switch (targetType) {
      case 'string':
        return String(value);

      case 'number':
        const num = Number(value);
        return isNaN(num) ? value : num;

      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);

      case 'date':
        if (typeof value === 'string' || typeof value === 'number') {
          const date = new Date(value);
          return isNaN(date.getTime()) ? value : date;
        }
        return value;

      default:
        return value;
    }
  }
}

export default DataValidator;
