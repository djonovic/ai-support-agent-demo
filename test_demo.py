import sys, json, asyncio
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv)>1 else "http://localhost:8765/"
OUT = "screenshots/"
async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1440,"height":900})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_selector(".msg.bot")
        async def say(t):
            n = await pg.locator(".msg.bot").count()
            await pg.fill("#msg", t); await pg.press("#msg","Enter")
            await pg.wait_for_function(f"document.querySelectorAll('.msg.bot').length>{n}")
            await pg.wait_for_timeout(150)
            return await pg.locator(".msg.bot").last.inner_text()
        res = {}
        for q in ["How much does teeth whitening cost?","Are you open on Saturday?","What is your cancellation policy?","Do you accept insurance?","Do you do hair transplants?"]:
            a = await say(q); res[q]=a; print("Q:",q,"\nA:",a,"\n")
        assert "KB-04" in res["How much does teeth whitening cost?"] and "290" in res["How much does teeth whitening cost?"]
        assert "KB-01" in res["Are you open on Saturday?"]
        assert "KB-08" in res["What is your cancellation policy?"]
        assert "won't guess" in res["Do you do hair transplants?"]
        for t in ["Hi, I'm Ana Petrovic, I'd like to book an implant consultation","My budget is around €1500","next month"]:
            print("U:",t,"\nA:", await say(t), "\n")
        lead = json.loads(await pg.inner_text("#leadjson"))
        print("LEAD", lead); assert lead["name"]=="Ana Petrovic" and lead["need"]=="implant" and lead["budget"]["amount"]==1500 and lead["timeline"]=="next month"
        await pg.click(".tab[data-tab=lead]")
        await pg.screenshot(path=OUT+"02-lead-card.png")
        await pg.locator(".slot").nth(1).click(); await pg.wait_for_timeout(400)
        last = await pg.locator(".msg.bot").last.inner_text(); print("BOOK:", last); assert "Booked" in last
        wh = await pg.inner_text("#webhook"); assert "lead.booked" in wh
        lead = json.loads(await pg.inner_text("#leadjson")); assert lead["status"]=="booked"
        await pg.screenshot(path=OUT+"03-booked-webhook.png")
        await pg.click(".tab[data-tab=lead]"); await pg.screenshot(path=OUT+"04-booked-lead.png")
        assert not errs, errs
        # covers: fresh page, scripted conversation, lead tab visible
        for (w,h,name) in [(1600,1200,"cover-1600x1200.png"),(1280,769,"cover-1280x769.png")]:
            c = await b.new_page(viewport={"width":w,"height":h})
            await c.goto(URL); await c.wait_for_selector(".msg.bot")
            for t in ["How much does teeth whitening cost?","Hi, I'm Ana Petrovic, I'd like to book an implant consultation","My budget is around €1500 and I want to start next month"]:
                n = await c.locator(".msg.bot").count()
                await c.fill("#msg", t); await c.press("#msg","Enter")
                await c.wait_for_function(f"document.querySelectorAll('.msg.bot').length>{n+ (1 if 'next month' in t else 0)}")
            await c.locator(".slot").nth(2).click(); await c.wait_for_timeout(300)
            await c.click(".tab[data-tab=lead]"); await c.wait_for_timeout(500)
            await c.screenshot(path=OUT+name)
        await pg.close()
        m = await b.new_page(viewport={"width":390,"height":844}); await m.goto(URL); await m.wait_for_selector(".msg.bot")
        await m.screenshot(path=OUT+"05-mobile.png")
        print("ALL TESTS PASSED")
        await b.close()
asyncio.run(run())
