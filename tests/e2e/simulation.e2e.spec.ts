import { expect, test, type Page } from '@playwright/test';

async function waitForSimulationStatus(page: Page): Promise<void> {
  await expect(page.locator('#status')).toContainText('FPS', { timeout: 5_000 });
}

test.describe('生態系観察画面', () => {
  test('初期表示でCanvasに生態系が描画される', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act
    await waitForSimulationStatus(page);
    const nonBackgroundPixels = await page.locator('#biotope').evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext('2d');
      if (!context) return 0;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] !== 17 || pixels[index + 1] !== 24 || pixels[index + 2] !== 39) count += 1;
      }
      return count;
    });

    // Assert
    await expect(page.locator('#biotope')).toBeVisible();
    expect(nonBackgroundPixels).toBeGreaterThan(0);
    await expect(page.locator('#status')).toContainText('草');
  });

  test('リセット後に個体数が0になり、追加操作で草食個体が表示される', async ({ page }) => {
    // Arrange
    await page.goto('/');
    await waitForSimulationStatus(page);

    // Act
    await page.locator('#reset').click();

    // Assert
    await expect(page.locator('#status')).toContainText('草 0  草食 0  肉食 0');

    // Act
    await page.locator('#add-herbivores').click();

    // Assert
    await expect(page.locator('#status')).toContainText('草食 10');
  });

  test('設定スライダーを操作すると現在値が更新される', async ({ page }) => {
    // Arrange
    await page.goto('/');
    const sightSlider = page.locator('#herbivore-sight');
    const sightValue = page.locator('#herbivore-sight-value');

    // Act
    await sightSlider.fill('25');

    // Assert
    await expect(sightValue).toHaveText('25px');
  });
});
