import { describe, it, expect } from 'vitest';
import {
    loginSchema,
    registerSchema,
    updateUserSchema,
    updatePasswordSchema,
    roleSchema,
    settingSchema,
} from '@/core/lib/validations';

describe('loginSchema', () => {
    // Login intentionally relaxed — legacy accounts whose passwords predate
    // the current policy must still be able to sign in. Full policy applies
    // to registration + password change + reset.
    it('accepts valid credentials', () => {
        const result = loginSchema.safeParse({ email: 'test@example.com', password: 'Password1' });
        expect(result.success).toBe(true);
    });

    it('accepts legacy short passwords (pre-policy accounts)', () => {
        const result = loginSchema.safeParse({ email: 'test@example.com', password: 'legacy' });
        expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
        const result = loginSchema.safeParse({ email: 'notanemail', password: 'Password1' });
        expect(result.success).toBe(false);
    });

    it('rejects empty password', () => {
        const result = loginSchema.safeParse({ email: 'test@example.com', password: '' });
        expect(result.success).toBe(false);
    });

    it('rejects password over 128 chars', () => {
        const long = 'A1' + 'a'.repeat(129);
        const result = loginSchema.safeParse({ email: 'test@example.com', password: long });
        expect(result.success).toBe(false);
    });
});

describe('registerSchema', () => {
    // 10-char minimum per the updated password policy.
    const valid = { email: 'user@test.com', username: 'player1', password: 'Secret9999', confirmPassword: 'Secret9999' };

    it('accepts valid registration', () => {
        expect(registerSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects mismatched passwords', () => {
        const result = registerSchema.safeParse({ ...valid, confirmPassword: 'Different99' });
        expect(result.success).toBe(false);
    });

    it('rejects short username', () => {
        const result = registerSchema.safeParse({ ...valid, username: 'ab' });
        expect(result.success).toBe(false);
    });

    it('rejects username with special chars', () => {
        const result = registerSchema.safeParse({ ...valid, username: 'user@name' });
        expect(result.success).toBe(false);
    });

    it('rejects long username (>20)', () => {
        const result = registerSchema.safeParse({ ...valid, username: 'a'.repeat(21) });
        expect(result.success).toBe(false);
    });

    it('allows underscores in username', () => {
        const result = registerSchema.safeParse({ ...valid, username: 'my_user' });
        expect(result.success).toBe(true);
    });
});

describe('updateUserSchema', () => {
    it('accepts valid update', () => {
        const result = updateUserSchema.safeParse({ username: 'newname', avatar: 'https://img.example.com/a.png' });
        expect(result.success).toBe(true);
    });

    it('accepts empty object (all optional)', () => {
        expect(updateUserSchema.safeParse({}).success).toBe(true);
    });

    it('accepts null avatar', () => {
        expect(updateUserSchema.safeParse({ avatar: null }).success).toBe(true);
    });

    it('rejects invalid avatar URL', () => {
        const result = updateUserSchema.safeParse({ avatar: 'not-a-url' });
        expect(result.success).toBe(false);
    });
});

describe('updatePasswordSchema', () => {
    it('accepts valid password change', () => {
        const result = updatePasswordSchema.safeParse({
            currentPassword: 'old',
            newPassword: 'NewPass9999',
            confirmPassword: 'NewPass9999',
        });
        expect(result.success).toBe(true);
    });

    it('rejects when confirm does not match', () => {
        const result = updatePasswordSchema.safeParse({
            currentPassword: 'old',
            newPassword: 'NewPass9999',
            confirmPassword: 'Different99',
        });
        expect(result.success).toBe(false);
    });

    it('rejects short new passwords via policy', () => {
        const result = updatePasswordSchema.safeParse({
            currentPassword: 'old',
            newPassword: 'Short1A',
            confirmPassword: 'Short1A',
        });
        expect(result.success).toBe(false);
    });
});

describe('roleSchema', () => {
    it('accepts valid role', () => {
        const result = roleSchema.safeParse({ name: 'moderator', displayName: 'Moderator' });
        expect(result.success).toBe(true);
    });

    it('rejects uppercase role name', () => {
        const result = roleSchema.safeParse({ name: 'Admin', displayName: 'Admin' });
        expect(result.success).toBe(false);
    });

    it('rejects role name with spaces', () => {
        const result = roleSchema.safeParse({ name: 'my role', displayName: 'My Role' });
        expect(result.success).toBe(false);
    });

    it('allows underscores in role name', () => {
        const result = roleSchema.safeParse({ name: 'super_admin', displayName: 'Super Admin' });
        expect(result.success).toBe(true);
    });
});

describe('settingSchema', () => {
    it('accepts string value', () => {
        expect(settingSchema.safeParse({ key: 'site_name', value: 'My Site' }).success).toBe(true);
    });

    it('accepts object value', () => {
        expect(settingSchema.safeParse({ key: 'config', value: { a: 1 } }).success).toBe(true);
    });

    it('rejects empty key', () => {
        expect(settingSchema.safeParse({ key: '', value: 'x' }).success).toBe(false);
    });
});
