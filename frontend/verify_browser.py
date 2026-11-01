"""Browser test script verifying Phase 6 frontend dashboard and chat."""

import asyncio
import os
import sys
from playwright.async_api import async_playwright

ARTIFACT_DIR = r"C:\Users\prachi\.gemini\antigravity\brain\4f8e5699-0939-44c8-881d-e0de79310d73"

async def run_browser_tests():
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    desktop_shot = os.path.join(ARTIFACT_DIR, "dashboard_desktop.png")
    mobile_shot = os.path.join(ARTIFACT_DIR, "dashboard_mobile.png")
    chat_shot = os.path.join(ARTIFACT_DIR, "chat_streamed.png")
    error_shot = os.path.join(ARTIFACT_DIR, "error_state.png")

    console_errors = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # -------------------------------------------------------------
        # Test 1: Desktop Viewport (1280x800) - Ahmedabad cards & charts
        # -------------------------------------------------------------
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("Navigating to http://localhost:5173 (Desktop)...")
        await page.goto("http://localhost:5173", wait_until="networkidle")

        # Wait for Ahmedabad conditions and charts to render
        await page.wait_for_selector("h2:has-text('Ahmedabad')", timeout=15000)
        await page.wait_for_selector("text=7-Day Weather Forecast", timeout=10000)
        await page.wait_for_selector("text=Air Quality Index (AQI)", timeout=10000)

        # Take desktop screenshot
        await page.screenshot(path=desktop_shot, full_page=True)
        print(f"Captured desktop screenshot: {desktop_shot}")

        # -------------------------------------------------------------
        # Test 2: Chat Interaction - "Will it rain tomorrow?"
        # -------------------------------------------------------------
        print("Testing Chat: Will it rain tomorrow?...")
        chat_input = page.locator("input[aria-label='Meteorological chat message input']")
        await chat_input.fill("Will it rain tomorrow in Ahmedabad?")
        await page.click("button:has-text('Send')")

        # Wait for assistant response to stream and complete
        await page.wait_for_selector("text=Weather Data Sources:", timeout=25000)
        await page.screenshot(path=chat_shot, full_page=True)
        print(f"Captured chat screenshot: {chat_shot}")

        # -------------------------------------------------------------
        # Test 3: Mobile Viewport (390x844 - iPhone width)
        # -------------------------------------------------------------
        mobile_page = await browser.new_page(viewport={"width": 390, "height": 844})
        print("Navigating to http://localhost:5173 (Mobile)...")
        await mobile_page.goto("http://localhost:5173", wait_until="networkidle")
        await mobile_page.wait_for_selector("h2:has-text('Ahmedabad')", timeout=10000)
        await mobile_page.screenshot(path=mobile_shot, full_page=True)
        print(f"Captured mobile screenshot: {mobile_shot}")

        # -------------------------------------------------------------
        # Test 4: Forced API Failure / Error State
        # -------------------------------------------------------------
        error_page = await browser.new_page(viewport={"width": 1280, "height": 800})
        # Route /api/weather/current to fail with 500
        await error_page.route("**/api/weather/current*", lambda route: route.abort())
        print("Navigating with simulated network abort...")
        await error_page.goto("http://localhost:5173")
        await error_page.wait_for_selector("div[role='alert']", timeout=10000)
        await error_page.screenshot(path=error_shot, full_page=True)
        print(f"Captured error state screenshot: {error_shot}")

        await browser.close()

    print(f"\nBrowser test complete. Total console errors recorded: {len(console_errors)}")
    for err in console_errors:
        print(f"Console error: {err}")

if __name__ == "__main__":
    asyncio.run(run_browser_tests())
