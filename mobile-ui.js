/* Progressive enhancement: all settings remain visible without JavaScript. */
(() => {
  const panel = document.querySelector('.controls');
  if (!panel) return;
  const media = window.matchMedia("(max-width: 760px), (max-width: 1024px) and (max-height: 600px) and (pointer: coarse)");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mobile-controls-toggle";
  let expanded = false;
  const paint = () => {
    panel.dataset.mobileCollapsed = String(!expanded);
    button.setAttribute("aria-expanded", String(!media.matches || expanded));
    const english = document.documentElement.lang.startsWith("en");
    button.textContent = (english ? "Company & period settings" : '选择公司与季度') + (expanded ? (english ? " · Collapse −" : " · 收起 −") : (english ? " · Expand ＋" : " · 展开 ＋"));
  };
  button.addEventListener("click", () => { expanded = !expanded; paint(); window.dispatchEvent(new Event("resize")); });
  panel.prepend(button);
  paint();
  media.addEventListener("change", paint);
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  const apply = panel.querySelector("#renderBtn, #run-backtest");
  if (apply) apply.addEventListener("click", () => {
    if (!media.matches) return;
    expanded = false;
    paint();
    window.dispatchEvent(new Event("resize"));
    button.scrollIntoView({ block: "start" });
  });
})();

(() => {
  const stage = document.querySelector(".preview-stage");
  if (!stage) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mobile-preview-toggle";
  button.textContent = "放大图表 · 可左右滑动查看";
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    const zoomed = stage.classList.toggle("is-zoomed");
    button.setAttribute("aria-pressed", String(zoomed));
    button.textContent = zoomed ? "适应屏幕宽度" : "放大图表 · 可左右滑动查看";
  });
  stage.prepend(button);
})();
