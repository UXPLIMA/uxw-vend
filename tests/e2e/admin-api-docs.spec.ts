import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Admin API docs', () => {
    test('Swagger UI renders OpenAPI explorer', async ({ page }) => {
        await login(page);

        const response = await page.goto('/en/admin/api-docs');
        expect(response?.status(), 'api-docs HTTP status').toBeLessThan(400);

        await expect(
            page.getByRole('heading', { name: /API Documentation/i }).first(),
        ).toBeVisible();

        // Swagger UI mounts a .swagger-ui container asynchronously
        const swagger = page.locator('.swagger-ui').first();
        await expect(swagger).toBeVisible({ timeout: 20_000 });

        // At least one section should render — either info block or an operation tag
        const anyBlock = page
            .locator('.swagger-ui .info, .swagger-ui .opblock, .swagger-ui .opblock-tag')
            .first();
        await expect(anyBlock).toBeVisible({ timeout: 20_000 });
    });
});
