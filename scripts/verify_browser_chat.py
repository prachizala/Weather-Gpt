"""Automated Playwright interaction script to test chat questions and capture screenshots."""

import asyncio
from playwright.async_api import async_playwright

FRONTEND_URL = "http://localhost:5173"
ARTIFACT_DIR = "C:/Users/prachi/.gemini/antigravity/brain/4f8e5699-0939-44c8-881d-e0de79310d73"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        print("Navigating to frontend...")
        await page.goto(FRONTEND_URL, wait_until="networkidle")
        await page.wait_for_selector("text=WeatherGPT", timeout=15000)

        # Locate chat textarea and send button
        textarea = page.locator("textarea[aria-label='Meteorological chat message input']")
        send_btn = page.locator("button[aria-label='Send message']")
        await textarea.wait_for()

        # -------------------------------------------------------------
        # Question 1: "Will it rain tomorrow in Ahmedabad?"
        # -------------------------------------------------------------
        print("Asking: Will it rain tomorrow in Ahmedabad?...")
        await textarea.fill("Will it rain tomorrow in Ahmedabad?")
        await send_btn.click()

        # Wait for assistant response
        # The assistant response will contain an answer and sources
        await page.wait_for_selector("text=Tomorrow", timeout=15000)
        # Also ensure "Thinking..." is gone
        await page.wait_for_selector("text=Thinking...", state="detached", timeout=10000)
        await asyncio.sleep(2)

        # Take screenshot of Ahmedabad answer
        chat_section = page.locator("section[aria-label='Grounded AI Conversational Assistant']")
        await chat_section.scroll_into_view_if_needed()
        ahmedabad_path = f"{ARTIFACT_DIR}/openrouter_chat_ahmedabad.png"
        await page.screenshot(path=ahmedabad_path)
        print(f"Captured screenshot: {ahmedabad_path}")

        # -------------------------------------------------------------
        # Question 2: Hindi question: "क्या कल बारिश होगी?"
        # -------------------------------------------------------------
        print("Asking Hindi question...")
        await textarea.fill("क्या कल बारिश होगी?")
        await send_btn.click()

        # Wait for assistant reply in Hindi
        await asyncio.sleep(1)
        await page.wait_for_selector("text=Thinking...", state="detached", timeout=15000)
        await asyncio.sleep(2)

        await chat_section.scroll_into_view_if_needed()
        hindi_path = f"{ARTIFACT_DIR}/openrouter_chat_hindi.png"
        await page.screenshot(path=hindi_path)
        print(f"Captured screenshot: {hindi_path}")

        await browser.close()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(main())
