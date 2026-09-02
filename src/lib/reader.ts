import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PageFlip } from 'page-flip/dist/js/page-flip.module.js';
GlobalWorkerOptions.workerSrc = workerUrl;

const shell = document.querySelector<HTMLElement>('[data-reader]');
if (shell) setupReader(shell);

function setupReader(shell: HTMLElement) {
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const mobileQuery = matchMedia('(max-width: 760px)');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = el('desktop-reader'),
    mobile = el('mobile-pages'),
    frame = el('book-frame');
  const loading = el('reader-loading'),
    error = el('reader-error');
  const progress = el<HTMLInputElement>('page-range'),
    status = el('page-status');
  const prev = document.querySelector<HTMLButtonElement>('.previous-page')!;
  const next = document.querySelector<HTMLButtonElement>('.next-page')!;
  const zoomOpen = el<HTMLButtonElement>('zoom-open'),
    zoom = el<HTMLDialogElement>('zoom-dialog');
  const zoomPage = el<HTMLSelectElement>('zoom-page'),
    zoomLevel = el<HTMLSelectElement>('zoom-level');
  const contents = el('reader-contents'),
    contentsToggle = document.querySelector<HTMLButtonElement>('.contents-toggle')!;
  let pdf: PDFDocumentProxy,
    flip: PageFlip | null = null,
    pageCount = Number(shell.dataset.pages);
  let current = Math.min(
    pageCount,
    Math.max(1, Math.trunc(Number(new URL(location.href).searchParams.get('page'))) || 1),
  );
  let generation = 0,
    observer: IntersectionObserver | undefined;
  let queue = Promise.resolve();
  let mounting = false;
  let pageNodes: HTMLElement[] = [];
  const inflight = new Map<HTMLElement, Promise<void>>();
  const rendered = new Map<HTMLElement, number>();

  function pageElement(page: number) {
    const node = document.createElement('div');
    node.className = 'pdf-page';
    node.dataset.page = String(page);
    node.setAttribute('role', 'group');
    node.setAttribute('aria-label', `PDF page ${page}`);
    node.style.aspectRatio = shell.dataset.ratio || '.773';
    const wait = document.createElement('span');
    wait.className = 'page-placeholder';
    wait.textContent = `Page ${page}`;
    node.append(wait);
    return node;
  }

  function renderPage(node: HTMLElement, number: number, width: number, force = false) {
    if (rendered.has(node) && !force) return Promise.resolve();
    if (inflight.has(node)) return inflight.get(node)!;
    const version = generation;
    const task = queue
      .then(async () => {
        if (!node.isConnected || version !== generation) return;
        const page = await pdf.getPage(number);
        const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
        const density = Math.min(devicePixelRatio || 1, 2);
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width * density);
        canvas.height = Math.ceil(viewport.height * density);
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.setAttribute('aria-hidden', 'true');
        await page.render({
          canvas,
          viewport,
          transform: density !== 1 ? [density, 0, 0, density, 0, 0] : undefined,
        }).promise;
        if (!node.isConnected || version !== generation) {
          canvas.width = 1;
          return;
        }
        const text = document.createElement('div');
        text.className = 'textLayer';
        text.style.setProperty('--total-scale-factor', String(viewport.scale));
        node.style.width = `${viewport.width}px`;
        node.style.height = `${viewport.height}px`;
        node.replaceChildren(canvas, text);
        try {
          await new TextLayer({
            textContentSource: await page.getTextContent(),
            container: text,
            viewport,
          }).render();
        } catch {
          text.remove();
        }
        rendered.set(node, number);
      })
      .catch((e) => {
        if (version !== generation || !node.isConnected) return;
        console.error('PDF page rendering failed', e);
        node.replaceChildren();
        const retry = document.createElement('button');
        retry.className = 'page-retry';
        retry.textContent = `Retry page ${number}`;
        retry.addEventListener('click', (event) => {
          event.stopPropagation();
          void renderPage(node, number, width, true);
        });
        node.append(retry);
      })
      .finally(() => inflight.delete(node));
    queue = task;
    inflight.set(node, task);
    return task;
  }

  function discardDistantPages() {
    for (const [node, number] of rendered)
      if (
        !zoom.contains(node) &&
        Math.abs(number - current) > (mobileQuery.matches ? 5 : 6) &&
        !inflight.has(node)
      ) {
        node.querySelectorAll('canvas').forEach((c) => {
          c.width = 1;
          c.height = 1;
        });
        node.replaceChildren();
        rendered.delete(node);
      }
  }

  async function showNearby() {
    const pages = [current, current + 1, current - 1, current + 2, current - 2, current + 3].filter(
      (n) => n >= 1 && n <= pageCount,
    );
    for (const number of pages) await renderPage(pageNodes[number - 1], number, 560);
    discardDistantPages();
  }

  function update(page: number) {
    current = Math.max(1, Math.min(pageCount, page));
    const right =
      !mobileQuery.matches && current > 1 && current < pageCount ? ` – ${current + 1}` : '';
    status.textContent = `${current}${right} / ${pageCount}`;
    frame.classList.toggle('front-cover', current === 1);
    frame.classList.toggle('back-cover', current === pageCount && pageCount % 2 === 0);
    progress.value = String(current);
    progress.setAttribute('aria-valuetext', `PDF page ${current} of ${pageCount}`);
    prev.disabled = current === 1;
    next.disabled = current >= pageCount - (pageCount % 2 ? 1 : 0);
    const address = new URL(location.href);
    address.searchParams.set('page', String(current));
    history.replaceState(null, '', address);
    document.querySelectorAll<HTMLElement>('[data-page]').forEach((node) => {
      if (node.matches('button')) {
        if (Number(node.dataset.page) === current) node.setAttribute('aria-current', 'page');
        else node.removeAttribute('aria-current');
      }
    });
    if (!mobileQuery.matches) void showNearby();
    else discardDistantPages();
  }

  function fitBook() {
    if (mobileQuery.matches) return;
    const height = 560 / Number(shell.dataset.ratio || 0.773);
    const scale = Math.min(
      (desktop.clientWidth - 110) / 1120,
      (desktop.clientHeight - 18) / height,
      1.4,
    );
    frame.style.width = `${1120 * scale}px`;
    frame.style.height = `${height * scale}px`;
    frame.style.setProperty('--book-scale', String(scale));
  }

  async function mount() {
    const version = ++generation;
    const target = current;
    mounting = true;
    observer?.disconnect();
    flip?.destroy();
    flip = null;
    rendered.clear();
    mobile.replaceChildren();
    frame.replaceChildren();
    desktop.hidden = mobileQuery.matches;
    mobile.hidden = !mobileQuery.matches;
    pageNodes = Array.from({ length: pageCount }, (_, i) => pageElement(i + 1));
    if (mobileQuery.matches) {
      mobile.replaceChildren(...pageNodes);
      const pageWidth = mobile.clientWidth;
      for (const node of pageNodes) {
        node.style.width = `${pageWidth}px`;
        node.style.height = `${pageWidth / Number(shell.dataset.ratio)}px`;
      }
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting)
              void renderPage(
                entry.target as HTMLElement,
                Number((entry.target as HTMLElement).dataset.page),
                pageWidth,
              );
        },
        { rootMargin: '800px 0px' },
      );
      pageNodes.forEach((node) => observer!.observe(node));
      await renderPage(pageNodes[target - 1], target, pageWidth);
      if (version !== generation) return;
      if (target > 1) pageNodes[target - 1].scrollIntoView({ behavior: 'instant', block: 'start' });
      current = target;
    } else {
      const book = document.createElement('div');
      book.id = 'flip-book';
      book.append(...pageNodes);
      frame.replaceChildren(book);
      flip = new PageFlip(book, {
        width: 560,
        height: 560 / Number(shell.dataset.ratio),
        size: 'fixed',
        showCover: true,
        usePortrait: false,
        autoSize: false,
        drawShadow: !reduceMotion.matches,
        maxShadowOpacity: 0.28,
        flippingTime: reduceMotion.matches ? 1 : 550,
        showPageCorners: !reduceMotion.matches,
        disableFlipByClick: true,
        useMouseEvents: !reduceMotion.matches,
        startPage: current - 1,
      });
      flip.on('flip', (event) => update(Number(event.data) + 1));
      flip.loadFromHTML(pageNodes);
      fitBook();
      current = flip.getCurrentPageIndex() + 1;
      await showNearby();
    }
    if (version !== generation) return;
    mounting = false;
    update(current);
  }

  function goTo(page: number) {
    const target = Math.max(1, Math.min(pageCount, page));
    if (mobileQuery.matches) {
      pageNodes[target - 1].scrollIntoView({ behavior: 'instant', block: 'start' });
      update(target);
    } else flip?.turnToPage(target - 1);
    contents.classList.remove('is-open');
    contentsToggle.setAttribute('aria-expanded', 'false');
  }

  async function start() {
    try {
      const task = getDocument({
        url: shell.dataset.pdf!,
        cMapUrl: `${shell.dataset.assets}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${shell.dataset.assets}standard_fonts/`,
        wasmUrl: `${shell.dataset.assets}wasm/`,
      });
      task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
        el('loading-detail').textContent = total
          ? `${Math.min(100, Math.round((loaded / total) * 100))}% loaded`
          : 'Opening the PDF…';
      };
      pdf = await task.promise;
      pageCount = pdf.numPages;
      progress.max = String(pageCount);
      for (let p = 1; p <= pageCount; p++) {
        const option = document.createElement('option');
        option.value = String(p);
        option.textContent = String(p);
        zoomPage.append(option);
      }
      loading.hidden = true;
      await mount();
      progress.disabled = false;
      zoomOpen.disabled = false;
    } catch (e) {
      console.error('PDF reader failed', e);
      loading.hidden = true;
      error.hidden = false;
      desktop.hidden = true;
      mobile.hidden = true;
    }
  }
  el('reader-retry').addEventListener('click', () => location.reload());
  prev.addEventListener('click', () => {
    if (reduceMotion.matches) goTo(current - (current === 2 ? 1 : 2));
    else flip?.flipPrev();
  });
  next.addEventListener('click', () => {
    if (reduceMotion.matches) goTo(current + (current === 1 ? 1 : 2));
    else flip?.flipNext();
  });
  progress.addEventListener('change', () => goTo(Number(progress.value)));
  document.querySelectorAll<HTMLButtonElement>('button[data-page]').forEach((button) =>
    button.addEventListener('click', () => {
      if (pdf) goTo(Number(button.dataset.page));
    }),
  );
  document.addEventListener('keydown', (event) => {
    if (!pdf || zoom.open || /INPUT|SELECT|TEXTAREA/.test((event.target as HTMLElement).tagName))
      return;
    if (event.key === 'ArrowRight' && !mobileQuery.matches) {
      event.preventDefault();
      next.click();
    }
    if (event.key === 'ArrowLeft' && !mobileQuery.matches) {
      event.preventDefault();
      prev.click();
    }
    if (event.key === 'Escape') {
      contents.classList.remove('is-open');
      contentsToggle.setAttribute('aria-expanded', 'false');
    }
  });
  contentsToggle.addEventListener('click', () => {
    const open = contents.classList.toggle('is-open');
    contentsToggle.setAttribute('aria-expanded', String(open));
  });
  document.querySelector('.contents-close')!.addEventListener('click', () => {
    contents.classList.remove('is-open');
    contentsToggle.setAttribute('aria-expanded', 'false');
    contentsToggle.focus();
  });
  el('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      el('fullscreen').setAttribute('title', 'Fullscreen is not available in this browser.');
    }
  });
  if (!document.fullscreenEnabled) el('fullscreen').hidden = true;
  let zoomVersion = 0;
  async function drawZoom() {
    const version = ++zoomVersion;
    const host = el('zoom-container');
    host.querySelectorAll<HTMLElement>('.pdf-page').forEach((node) => rendered.delete(node));
    host.replaceChildren();
    const node = pageElement(Number(zoomPage.value));
    host.append(node);
    const width = Math.max(550, Math.min(innerWidth - 90, 850)) * Number(zoomLevel.value);
    host.style.width = `${width}px`;
    await renderPage(node, Number(zoomPage.value), width, true);
    if (version !== zoomVersion) node.remove();
  }
  zoomOpen.addEventListener('click', () => {
    zoomPage.value = String(current);
    zoom.showModal();
    void drawZoom();
  });
  el('zoom-close').addEventListener('click', () => zoom.close());
  zoomPage.addEventListener('change', () => void drawZoom());
  zoomLevel.addEventListener('change', () => void drawZoom());
  zoom.addEventListener('close', () => {
    zoomVersion++;
    el('zoom-container')
      .querySelectorAll<HTMLElement>('.pdf-page')
      .forEach((node) => rendered.delete(node));
    el('zoom-container').replaceChildren();
    zoomOpen.focus();
  });
  let resizeTimer: ReturnType<typeof setTimeout>;
  let lastWidth = innerWidth,
    wasMobile = mobileQuery.matches;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!pdf) return;
      const modeChanged = wasMobile !== mobileQuery.matches;
      const widthChanged = lastWidth !== innerWidth;
      wasMobile = mobileQuery.matches;
      lastWidth = innerWidth;
      if (modeChanged || (wasMobile && widthChanged)) void mount();
      else if (!wasMobile) fitBook();
    }, 250);
  });
  let scrollTick = false;
  window.addEventListener(
    'scroll',
    () => {
      if (!pdf || mounting || !mobileQuery.matches || scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(() => {
        const node = pageNodes.find((n) => n.getBoundingClientRect().bottom > innerHeight * 0.35);
        if (node && Number(node.dataset.page) !== current) update(Number(node.dataset.page));
        scrollTick = false;
      });
    },
    { passive: true },
  );
  void start();
}
