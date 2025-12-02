import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_viewport_size({"width": 1280, "height": 800})
        await page.goto("http://localhost:15915")
        # 等待数据加载
        await page.wait_for_selector("table")
        # 稍微多等一下确保渲染完成
        await asyncio.sleep(1)
        await page.screenshot(path="screenshot.png", full_page=True)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
