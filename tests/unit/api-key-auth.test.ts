import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// Mock prisma
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/core/lib/db', () => ({
    prisma: {
        apiKey: {
            findMany: (...args: unknown[]) => mockFindMany(...args),
            update: (...args: unknown[]) => mockUpdate(...args),
        },
    },
}));

import { validateApiKey } from '@/core/lib/api-key-auth';

describe('validateApiKey', () => {
    const rawKey = 'uxw_abc123def456ghijklmnopqrstuvwxyz0123456789ab';
    const prefix = rawKey.slice(0, 12); // 'uxw_abc123de'
    let keyHash: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        keyHash = await bcrypt.hash(rawKey, 4); // low rounds for speed
    });

    it('returns valid for correct key', async () => {
        mockFindMany.mockResolvedValue([{
            id: 'key1', keyHash, keyPrefix: prefix, userId: 'user1',
            permissions: ['*'], isActive: true, expiresAt: null,
        }]);
        mockUpdate.mockResolvedValue({});

        const result = await validateApiKey(rawKey);
        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.keyId).toBe('key1');
            expect(result.userId).toBe('user1');
        }
    });

    it('returns invalid for wrong key', async () => {
        mockFindMany.mockResolvedValue([{
            id: 'key1', keyHash, keyPrefix: prefix, userId: 'user1',
            permissions: ['*'], isActive: true, expiresAt: null,
        }]);

        const result = await validateApiKey('uxw_abc123deWRONGKEYHERE000000000000000000000000');
        expect(result.valid).toBe(false);
    });

    it('returns invalid when no candidates found', async () => {
        mockFindMany.mockResolvedValue([]);

        const result = await validateApiKey(rawKey);
        expect(result.valid).toBe(false);
        if (!result.valid) expect(result.status).toBe(401);
    });

    it('returns 403 when key lacks required permission', async () => {
        mockFindMany.mockResolvedValue([{
            id: 'key1', keyHash, keyPrefix: prefix, userId: 'user1',
            permissions: ['read:data'], isActive: true, expiresAt: null,
        }]);
        mockUpdate.mockResolvedValue({});

        const result = await validateApiKey(rawKey, 'cron:run');
        expect(result.valid).toBe(false);
        if (!result.valid) expect(result.status).toBe(403);
    });

    it('allows wildcard permission', async () => {
        mockFindMany.mockResolvedValue([{
            id: 'key1', keyHash, keyPrefix: prefix, userId: 'user1',
            permissions: ['*'], isActive: true, expiresAt: null,
        }]);
        mockUpdate.mockResolvedValue({});

        const result = await validateApiKey(rawKey, 'any:permission');
        expect(result.valid).toBe(true);
    });

    it('skips expired keys', async () => {
        mockFindMany.mockResolvedValue([{
            id: 'key1', keyHash, keyPrefix: prefix, userId: 'user1',
            permissions: ['*'], isActive: true, expiresAt: new Date('2020-01-01'),
        }]);

        const result = await validateApiKey(rawKey);
        expect(result.valid).toBe(false);
    });

    it('updates lastUsedAt on valid key', async () => {
        mockFindMany.mockResolvedValue([{
            id: 'key1', keyHash, keyPrefix: prefix, userId: 'user1',
            permissions: ['*'], isActive: true, expiresAt: null,
        }]);
        mockUpdate.mockResolvedValue({});

        await validateApiKey(rawKey);
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'key1' } })
        );
    });
});
