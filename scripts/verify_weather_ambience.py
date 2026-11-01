"""Test each weather and time ambience mode and capture screenshots."""

import asyncio
from playwright.async_api import async_playwright

FRONTEND_URL = "http://localhost:5173"
ARTIFACT_DIR = "C:/Users/prachi/.gemini/antigravity/brain/4f8e5699-0939-44c8-881d-e0de79310d73"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 850})
        page = await context.new_page()

        print("Navigating to frontend...")
        await page.goto(FRONTEND_URL, wait_until="networkidle")
        await page.wait_for_selector("text=WeatherGPT", timeout=15000)

        # Locate ambience select dropdown
        ambience_select = page.locator("select[aria-label='Select sky and weather ambience']")
        await ambience_select.wait_for()

        # 1. Test Morning (सुबह का सूरज)
        print("Switching to Morning Sun...")
        await ambience_select.select_option("morning")
        await asyncio.sleep(1.5)
        morning_path = f"{ARTIFACT_DIR}/ambience_morning_sun.png"
        await page.screenshot(path=morning_path)
        print(f"Captured: {morning_path}")

        # 2. Test Night (रात को चाँद तारे)
        print("Switching to Night Moon & Stars...")
        await ambience_select.select_option("night")
        await asyncio.sleep(1.5)
        night_path = f"{ARTIFACT_DIR}/ambience_night_moon_stars.png"
        await page.screenshot(path=night_path)
        print(f"Captured: {night_path}")

        # 3. Test Rain (बारिश)
        print("Switching to Rain...")
        await ambience_select.select_option("rain")
        await asyncio.sleep(1.5)
        rain_path = f"{ARTIFACT_DIR}/ambience_rain.png"
        await page.screenshot(path=rain_path)
        print(f"Captured: {rain_path}")

        # 4. Test Wind (हवा)
        print("Switching to Wind...")
        await ambience_select.select_option("wind")
        await asyncio.sleep(1.5)
        wind_path = f"{ARTIFACT_DIR}/ambience_wind.png"
        await page.screenshot(path=wind_path)
        print(f"Captured: {wind_path}")

        # 5. Test Storm (तूफ़ान और बिजली)
        print("Switching to Storm...")
        await ambience_select.select_option("storm")
        await asyncio.sleep(1.5)
        storm_path = f"{ARTIFACT_DIR}/ambience_storm.png"
        await page.screenshot(path=storm_path)
        print(f"Captured: {storm_path}")

        # Switch back to Auto
        await ambience_select.select_option("auto")
        await asyncio.sleep(1)

        await browser.close()
        print("Ambience verification finished successfully!")

if __name__ == "__main__":
    asyncio.run(main())
