(function () {
  const main = document.querySelector('main.main');
  if (!main) return;

  let bar = null;
  function getBar() {
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'route-bar';
      document.body.appendChild(bar);
    }
    return bar;
  }
  function barStart() {
    const b = getBar();
    b.style.transition = 'none';
    b.style.width = '0%';
    // force reflow so the next width change animates
    // eslint-disable-next-line no-unused-expressions
    b.offsetWidth;
    b.style.transition = '';
    b.classList.add('is-active');
    requestAnimationFrame(() => { b.style.width = '75%'; });
  }
  function barDone() {
    const b = getBar();
    b.style.width = '100%';
    setTimeout(() => {
      b.classList.remove('is-active');
      b.style.width = '0%';
    }, 180);
  }

  function currentKey() {
    return location.pathname + location.search;
  }

  function isRoutable(url) {
    if (url.origin !== location.origin) return false;
    if (!/\.html?$/.test(url.pathname)) return false;
    return true;
  }

  async function navigate(href, { push = true } = {}) {
    const url = new URL(href, location.href);
    const key = url.pathname + url.search;
    if (push && key === currentKey()) return;

    barStart();
    main.classList.add('is-leaving');

    let html;
    try {
      const res = await fetch(url.pathname + url.search, { headers: { 'X-Requested-With': 'router' } });
      if (!res.ok) throw new Error('bad status');
      html = await res.text();
    } catch (err) {
      location.href = href;
      return;
    }

    // hold the fade-out for its transition duration
    await new Promise((resolve) => setTimeout(resolve, 90));

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newMain = doc.querySelector('main.main');
    if (!newMain) {
      location.href = href;
      return;
    }

    main.innerHTML = newMain.innerHTML;
    main.className = newMain.className;
    document.title = doc.title;

    const newNav = doc.querySelector('#app-nav');
    const liveNav = document.getElementById('app-nav');
    if (newNav && liveNav) liveNav.className = newNav.className;

    if (push) {
      history.pushState({}, '', url.pathname + url.search);
    }

    if (typeof renderNav === 'function') renderNav();
    window.scrollTo(0, 0);

    main.classList.remove('is-leaving');
    main.classList.add('is-entering');
    // eslint-disable-next-line no-unused-expressions
    main.offsetWidth;
    requestAnimationFrame(() => main.classList.remove('is-entering'));

    const scripts = Array.from(doc.querySelectorAll('script:not([src])'));
    for (const old of scripts) {
      const s = document.createElement('script');
      s.textContent = old.textContent;
      document.body.appendChild(s);
      document.body.removeChild(s);
    }

    barDone();
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a');
    if (!link || !link.href) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;
    if (link.dataset.noRouter != null) return;

    let url;
    try { url = new URL(link.href, location.href); } catch (err) { return; }
    if (!isRoutable(url)) return;

    e.preventDefault();
    navigate(url.pathname + url.search);
  });

  window.addEventListener('popstate', () => {
    navigate(currentKey(), { push: false });
  });
})();
