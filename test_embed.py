"""Playwright check for the one-line embed: python3 test_embed.py https://djonovic.github.io/ai-support-agent-demo/"""
import sys
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else "https://djonovic.github.io/ai-support-agent-demo/"
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1366, "height": 820})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(base + "embed-demo.html", wait_until="networkidle")
    pg.click(".bsw-btn"); f = pg.frame_locator(".bsw-frame")
    def ask(q):
        f.locator("#i").fill(q); f.locator("#i").press("Enter"); pg.wait_for_timeout(700)
        return f.locator(".m.bot").last.inner_text()
    a = ask("How much does teeth whitening cost?"); assert "€290" in a and "KB-04" in a, a
    a = ask("Can you repair my car engine?"); assert "won't guess" in a, a
    ask("Book a visit"); ask("Ana Petrovic"); a = ask("ana@example.com"); assert "Request noted" in a, a
    f.locator("#x").click(); pg.wait_for_timeout(300)
    assert "open" not in pg.get_attribute(".bsw-frame", "class")
    assert not errs, errs
    print("embed OK"); b.close()
