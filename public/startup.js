// Independent of the React bundle, dependencies, storage and the API.
// If the bundle cannot start, retain an actionable page rather than white space.
(function () {
  var root = document.getElementById('root');
  var screen = document.getElementById('store-startup');
  if (!root || !screen) return;
  var timer;
  var observer;
  function cleanup() {
    window.clearTimeout(timer);
    window.removeEventListener('error', onError, true);
    if (observer) observer.disconnect();
  }
  function recover() {
    if (!root.contains(screen)) { cleanup(); return; }
    screen.querySelector('h1').textContent = 'Taking longer than expected';
    document.getElementById('store-startup-message').textContent = 'Check your connection, then reload to try again.';
    document.getElementById('store-startup-retry').hidden = false;
  }
  function onError(event) {
    var target = event.target;
    if (target === window || (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK'))) recover();
  }
  window.addEventListener('error', onError, true);
  timer = window.setTimeout(recover, 12000);
  if (window.MutationObserver) {
    observer = new MutationObserver(function () {
      if (!root.contains(screen)) cleanup();
    });
    observer.observe(root, { childList: true });
  }
}());
