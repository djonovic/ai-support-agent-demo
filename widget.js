/*! BrightSmile demo chat widget — one-line embed. Demo with fictional data; no API keys, no tracking.
 * <script src="https://djonovic.github.io/ai-support-agent-demo/widget.js"
 *         data-title="BrightSmile Assistant" data-color="#0ea5a4" defer></script>
 * Options (all optional): data-title, data-color, data-greeting, data-position="right|left", data-open="true"
 */
(function () {
  if (window.__bsWidget) return; window.__bsWidget = true;
  var s = document.currentScript || document.querySelector('script[src*="widget.js"]');
  var d = (s && s.dataset) || {};
  var base = new URL("./", s ? s.src : location.href).href;
  var color = /^#[0-9a-f]{3,8}$/i.test(d.color || "") ? d.color : "#0ea5a4";
  var title = d.title || "BrightSmile Assistant";
  var left = d.position === "left";
  var q = new URLSearchParams({ title: title, color: color, greeting: d.greeting || "", host: location.hostname || "local" });
  var css = document.createElement("style");
  css.textContent =
    ".bsw-btn{position:fixed;bottom:20px;" + (left ? "left" : "right") + ":20px;z-index:2147483646;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;" +
    "background:" + color + ";color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.25);display:grid;place-items:center;transition:transform .15s}" +
    ".bsw-btn:hover{transform:scale(1.06)}.bsw-btn svg{width:28px;height:28px}" +
    ".bsw-frame{position:fixed;bottom:92px;" + (left ? "left" : "right") + ":20px;z-index:2147483647;width:380px;height:580px;max-height:calc(100vh - 112px);" +
    "border:0;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.28);background:#fff;opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .18s,transform .18s}" +
    ".bsw-frame.open{opacity:1;transform:none;pointer-events:auto}" +
    "@media (max-width:480px){.bsw-frame{left:8px;right:8px;width:calc(100vw - 16px);bottom:84px;height:calc(100vh - 100px)}}";
  document.head.appendChild(css);
  var btn = document.createElement("button");
  btn.className = "bsw-btn"; btn.type = "button"; btn.setAttribute("aria-label", "Open chat: " + title);
  var chatIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var xIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  btn.innerHTML = chatIcon;
  var frame = null, open = false;
  function toggle(v) {
    open = v === undefined ? !open : v;
    if (open && !frame) {
      frame = document.createElement("iframe");
      frame.className = "bsw-frame"; frame.title = title; frame.src = base + "embed.html?" + q.toString();
      frame.setAttribute("allow", "clipboard-write");
      document.body.appendChild(frame);
      frame.getBoundingClientRect();
    }
    if (frame) frame.classList.toggle("open", open);
    btn.innerHTML = open ? xIcon : chatIcon;
    btn.setAttribute("aria-expanded", String(open));
  }
  btn.onclick = function () { toggle(); };
  window.addEventListener("message", function (e) {
    if (frame && e.source === frame.contentWindow && e.data === "bsw:close") toggle(false);
  });
  function mount() { document.body.appendChild(btn); if (d.open === "true") toggle(true); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  window.BrightSmileWidget = { open: function () { toggle(true); }, close: function () { toggle(false); } };
})();
