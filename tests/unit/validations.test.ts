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
    it('accepts valid credentials', () => {
        const result = loginSchema.safeParse({ email: 'test@example.com', password: 'Password1' });
        expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
        const result = loginSchema.safeParse({ email: 'notanemail', password: 'Password1' });
        expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
        const result = loginSchema.safeParse({ email: 'test@example.com', password: 'Ab1' });
        expect(result.success).toBe(false);
    });

    it('rejects password without uppercase', () => {
        const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password1' });
        expect(result.success).toBe(false);
    });

    it('rejects password without number', () => {
        const result = loginSchema.safeParse({ email: 'test@example.com', password: 'Password' });
        expect(result.success).toBe(false);
    });

    it('rejects password over 100 chars', () => {
        const long = 'A1' + 'a'.repeat(99);
        const result = loginSchema.safeParse({ email: 'test@example.com', password: long });
        expect(result.success).toBe(false);
    });
});

describe('registerSchema', () => {
    const valid = { email: 'user@test.com', username: 'player1', password: 'Secret99', confirmPassword: 'Secret99' };

    it('accepts valid registration', () => {
        expect(registerSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects mismatched passwords', () => {
        const result = registerSchema.safeParse({ ...valid, confirmPassword: 'Different1' });
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
            newPassword: 'NewPass99',
            confirmPassword: 'NewPass99',
        });
        expect(result.success).toBe(true);
    });

    it('rejects when confirm does not match', () => {
        const result = updatePasswordSchema.safeParse({
            currentPassword: 'old',
            newPassword: 'NewPass99',
            confirmPassword: 'Different1',
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
