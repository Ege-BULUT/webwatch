/* FreeWebWatch embed: <script src="https://freewebwatch.vercel.app/embed.js" data-theme="..." data-ratio="16/9"></script> */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var t = s.getAttribute('data-theme') || '';
  var ratio = s.getAttribute('data-ratio') || '16/9';
  var f = document.createElement('iframe');
  f.src = new URL('./?embed=1', s.src).href + (t ? '#t=' + t : '');
  f.title = s.getAttribute('data-title') || 'FreeWebWatch';
  f.loading = 'lazy';
  f.style.cssText = 'border:0;width:100%;display:block;background:transparent;aspect-ratio:' + ratio;
  s.parentNode.insertBefore(f, s.nextSibling);
})();
