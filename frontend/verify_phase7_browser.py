"""Playwright browser verification for Phase 7: Historical Comparison & Advisories."""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ARTIFACTS_DIR = Path(r"C:\Users\prachi\.gemini\antigravity\brain\4f8e5699-0939-44c8-881d-e0de79310d73")

async def run_verification():
    console_errors = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1000})
        page = await context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("1. Navigating to http://localhost:5173 ...")
        await page.goto("http://localhost:5173", wait_until="networkidle")

        # Wait for current weather & advisories to load
        print("2. Checking Advisories Banner ...")
        await page.wait_for_selector("section[aria-labelledby='advisories-heading']", timeout=15000)
        
        # Verify the disclaimer exists
        disclaimer = await page.text_content("section[aria-labelledby='advisories-heading']")
        assert "App suggestion, not an official warning" in disclaimer, "Missing required advisory disclaimer!"
        print("   Advisory disclaimer verified.")

        # Check Historical Comparison section
        print("3. Checking Historical Comparison Card ...")
        await page.wait_for_selector("section[aria-labelledby='history-comparison-heading']", timeout=15000)
        await page.wait_for_selector(".recharts-responsive-container", timeout=15000)
        
        comp_text = await page.text_content("section[aria-labelledby='history-comparison-heading']")
        assert "Multi-Year Historical Comparison" in comp_text
        assert "Calculation Methodology" in comp_text
        assert "Statistical Limitations" in comp_text
        print("   Historical comparison table, chart, method and limitations verified.")

        # Take full page screenshot of desktop view with Phase 7 features
        desktop_shot = ARTIFACTS_DIR / "phase7_dashboard_desktop.png"
        await page.screenshot(path=str(desktop_shot), full_page=True)
        print(f"   Saved desktop screenshot: {desktop_shot}")

        # Test Chat with Historical Comparison Query
        print("4. Testing Chat Query for October rainfall comparison ...")
        chat_input = page.locator("input[aria-label='Chat message input']")
        await chat_input.fill("Compare rainfall this October with the previous five Octobers in Ahmedabad")
        await page.keyboard.press("Enter")

        # Wait for chat assistant to stream/return response
        await page.wait_for_timeout(6000)
        chat_shot = ARTIFACTS_DIR / "phase7_chat_comparison.png"
        await page.screenshot(path=str(chat_shot), full_page=True)
        print(f"   Saved chat comparison screenshot: {chat_shot}")

        # Check mobile responsiveness
        print("5. Checking mobile viewport (375x812) ...")
        await page.set_viewport_size({"width": 375, "height": 812})
        await page.wait_for_timeout(1000)
        mobile_shot = ARTIFACTS_DIR / "phase7_dashboard_mobile.png"
        await page.screenshot(path=str(mobile_shot), full_page=True)
        print(f"   Saved mobile screenshot: {mobile_shot}")

        await browser.close()

    print("\n--- Summary ---")
    print(f"Console errors caught: {len(console_errors)}")
    if console_errors:
        print("Errors:", console_errors)
    else:
        print("PASS: Zero console errors.")

if __name__ == "__main__":
    asyncio.run(run_verification())
