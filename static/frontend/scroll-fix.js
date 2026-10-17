const mediaQuery = window.matchMedia('(min-width: 768px)');
function handleScreenChange(e) {
  if (e.matches) {
    window.scrollTo({ top: 0});
  }
}
mediaQuery.addEventListener('change', handleScreenChange);

// 1. Prevent the browser from automatically restoring the previous scroll position
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// 2. Scroll to the top-left (0, 0) as soon as the window loads
window.addEventListener('load', () => {
  window.scrollTo(0, 0);
});