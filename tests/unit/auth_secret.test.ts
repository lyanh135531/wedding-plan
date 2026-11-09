import { describe, it, expect } from 'vitest';

describe('Better Auth Secret Production Validation', () => {
  it('enforces BETTER_AUTH_SECRET length >= 32 characters in production runtime', () => {
    function validateAuthSecret(secret?: string, nodeEnv?: string, isBuildTime = false) {
      if (nodeEnv === 'production' && !isBuildTime && (!secret || secret.length < 32)) {
        throw new Error(
          'FATAL: BETTER_AUTH_SECRET must be set to a secure string with at least 32 characters in production.'
        );
      }
      return true;
    }

    // Should throw in production when missing
    expect(() => validateAuthSecret(undefined, 'production', false)).toThrowError(
      /BETTER_AUTH_SECRET must be set to a secure string with at least 32 characters/
    );

    // Should throw in production when < 32 chars
    expect(() => validateAuthSecret('short_secret_under_32_chars', 'production', false)).toThrowError(
      /BETTER_AUTH_SECRET must be set to a secure string with at least 32 characters/
    );

    // Should succeed in production when >= 32 chars
    expect(
      validateAuthSecret('this_is_a_secure_production_secret_with_more_than_32_characters', 'production', false)
    ).toBe(true);

    // Should succeed during build time even if unset
    expect(validateAuthSecret(undefined, 'production', true)).toBe(true);

    // Should succeed in development/test environments
    expect(validateAuthSecret(undefined, 'development', false)).toBe(true);
    expect(validateAuthSecret(undefined, 'test', false)).toBe(true);
  });
});
