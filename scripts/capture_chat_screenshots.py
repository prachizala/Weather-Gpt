import asyncio
from playwright.async_api import async_playwright

async def capture():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.wait_for_selector("text=WeatherGPT")
        
        # 1. Initial empty chat state screenshot
        await page.screenshot(path="C:/Users/prachi/.gemini/antigravity/brain/4f8e5699-0939-44c8-881d-e0de79310d73/chat_initial_ui.png")
        
        # 2. Type question and send
        input_el = page.locator("[aria-label='Meteorological chat message input']")
        await input_el.fill("Will it rain tomorrow in Ahmedabad?")
        await page.keyboard.press("Enter")
        
        # Wait for answer and sources
        await page.wait_for_selector("text=WEATHER DATA SOURCES", timeout=30000)
        await page.wait_for_timeout(1000)
        
        # 3. Answered chat state screenshot
        await page.screenshot(path="C:/Users/prachi/.gemini/antigravity/brain/4f8e5699-0939-44c8-881d-e0de79310d73/chat_answered_ui.png")
        await browser.close()
        print("Captured screenshots successfully")

if __name__ == "__main__":
    asyncio.run(capture())
