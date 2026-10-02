/* ============================================================
 * Wakusei HomePage · article.js
 * 文章页交互:阅读进度 / 目录 / 阅读控制 dock / 复制代码 / 标题深链 / 灯箱 / Twikoo
 * 对齐原 scripts/article-runtime.ts + ArticleToc.vue + ReadingControls.vue
 * ============================================================ */
(function () {
    'use strict';
    var doc = document;
    var $ = function (s, r) { return (r || doc).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var scroller = $('#pageScroller') || $('.page-scroller');
    var body = $('.post-body');
    if (!body || !scroller) return;
    var CFG = window.__WAKUSEI__ || {};

    /* ---------------- 阅读进度条 ---------------- */
    (function progress() {
        var fill = $('.reading-progress__fill');
        if (!fill) return;
        var frame = 0;
        function update() {
            frame = 0;
            var bRect = body.getBoundingClientRect();
            var sRect = scroller.getBoundingClientRect();
            var start = bRect.top - sRect.top + scroller.scrollTop;
            var end = bRect.bottom - sRect.top + scroller.scrollTop - window.innerHeight;
            var p = end <= start ? 1 : Math.min(Math.max((scroller.scrollTop - start) / (end - start), 0), 1);
            fill.style.transform = 'scaleX(' + p + ')';
        }
        var onScroll = function () { if (!frame) frame = requestAnimationFrame(update); };
        scroller.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        if (scroller.scrollTop > 0) update();
    })();

    /* ---------------- 目录(TOC) ---------------- */
    (function toc() {
        var root = $('.article-toc');
        if (!root) return;
        var headings = $$('h2[id], h3[id]', body);
        if (!headings.length) { root.hidden = true; return; }
        root.hidden = false;

        /* 组树:h3 归属其前最近的 h2 */
        var items = [];
        headings.forEach(function (h) {
            var level = h.tagName === 'H2' ? 2 : 3;
            var title = (h.textContent || '').replace(/#\s*$/, '').trim();
            var item = { id: h.id, level: level, title: title, children: [] };
            if (level === 2) items.push(item);
            else if (items.length) items[items.length - 1].children.push(item);
            else items.push(item); /* 首个 h2 前的 h3 提升为顶层 */
        });

        root.innerHTML =
            '<button class="article-toc__capsule" type="button">' +
            '<svg class="svg-icon" viewBox="0 0 512 512" width="16" height="16" aria-hidden="true" style="display:inline-block;flex-shrink:0;vertical-align:-0.125em"><path fill="currentColor" d="M0 96C0 78.3 14.3 64 32 64l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 128C14.3 128 0 113.7 0 96zM64 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L96 288c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32L32 448c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"></path></svg>' +
            '<span class="article-toc__capsule-text">目录</span></button>' +
            '<aside class="article-toc__panel article-toc__panel--fixed" role="navigation" hidden>' +
            '<header class="article-toc__header"><span class="article-toc__title">目录</span>' +
            '<button class="article-toc__close" type="button" aria-label="收起目录">' +
            '<svg class="svg-icon" viewBox="0 0 384 512" width="14" height="14" aria-hidden="true" style="display:inline-block;flex-shrink:0"><path fill="currentColor" d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"></path></svg>' +
            '</button></header>' +
            '<ol class="article-toc__list">' + listHtml(items) + '</ol></aside>' +
            '<div class="article-toc__overlay" hidden></div>' +
            '<aside class="article-toc__panel article-toc__panel--drawer" role="dialog" aria-modal="true" hidden>' +
            '<header class="article-toc__header"><span class="article-toc__title">目录</span>' +
            '<button class="article-toc__close" type="button" aria-label="收起目录">' +
            '<svg class="svg-icon" viewBox="0 0 384 512" width="14" height="14" aria-hidden="true" style="display:inline-block;flex-shrink:0"><path fill="currentColor" d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"></path></svg>' +
            '</button></header>' +
            '<ol class="article-toc__list">' + listHtml(items) + '</ol></aside>';

        function listHtml(tree) {
            var html = '';
            tree.forEach(function (item) {
                var hasChildren = item.children.length > 0;
                html += '<li class="article-toc__item article-toc__item--level-' + item.level + (hasChildren ? ' has-children' : '') + '" data-id="' + item.id + '">' +
                    '<a class="article-toc__link" href="#' + item.id + '">' + item.title + '</a>';
                if (hasChildren) {
                    html += '<button class="article-toc__toggle" type="button" aria-expanded="true" aria-label="展开/收起小节">' +
                        '<svg class="svg-icon" viewBox="0 0 448 512" width="12" height="12" aria-hidden="true" style="display:inline-block;flex-shrink:0"><path fill="currentColor" d="M201.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 338.7 54.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"></path></svg></button>';
                    item.children.forEach(function (c) {
                        html += '<li class="article-toc__item article-toc__item--level-3 toc-subitem" data-parent="' + item.id + '" data-id="' + c.id + '">' +
                            '<a class="article-toc__link" href="#' + c.id + '">' + c.title + '</a></li>';
                    });
                }
                html += '</li>';
            });
            return html;
        }

        var capsule = $('.article-toc__capsule', root);
        var fixedPanel = $('.article-toc__panel--fixed', root);
        var drawer = $('.article-toc__panel--drawer', root);
        var overlayEl = $('.article-toc__overlay', root);
        var closeBtns = $$('.article-toc__close', root);
        var container = $('.post-container');
        var footer = $('.page-footer');
        var userOpened = false, userClosed = false;
        var activeId = null;
        var overrides = {};
        var panelFits = true, rightGap = 0;

        function headingList() { return headings; }
        function measure() {
            if (!container) return;
            var sRect = scroller.getBoundingClientRect();
            var cRect = container.getBoundingClientRect();
            rightGap = sRect.right - cRect.right;
            panelFits = rightGap >= 260;
            var rootEl = doc.documentElement;
            if (panelFits) {
                rootEl.style.setProperty('--toc-panel-left', (cRect.right + 30) + 'px');
                rootEl.style.setProperty('--toc-panel-width', Math.min(Math.max(rightGap - 40, 220), 360) + 'px');
            } else {
                rootEl.style.removeProperty('--toc-panel-left');
                rootEl.style.removeProperty('--toc-panel-width');
            }
        }

        /* 滚动高亮:可见 heading 中取 DOM 序第一个 */
        var visible = {};
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) visible[en.target.id] = true;
                else delete visible[en.target.id];
            });
            updateActive();
        }, { root: scroller, rootMargin: '-96px 0px -55% 0px', threshold: 0 });
        headings.forEach(function (h) { io.observe(h); });

        function currentActiveId() {
            for (var i = 0; i < headings.length; i++) {
                if (visible[headings[i].id]) return headings[i].id;
            }
            return activeId;
        }

        function updateActive() {
            var id = currentActiveId();
            if (!id) return;
            activeId = id;
            [fixedPanel, drawer].forEach(function (panel) {
                if (!panel || panel.hidden) return;
                $$('.article-toc__item', panel).forEach(function (li) {
                    li.classList.toggle('article-toc__item--active', li.getAttribute('data-id') === id);
                });
                $$('.toc-subitem', panel).forEach(function (li) {
                    var parent = li.getAttribute('data-parent');
                    var open = overrides[parent] === undefined ? parent === activeId : overrides[parent];
                    li.hidden = !open;
                });
                $$('.article-toc__toggle', panel).forEach(function (btn) {
                    var li = btn.closest('.article-toc__item');
                    var id2 = li.getAttribute('data-id');
                    var open = overrides[id2] === undefined ? id2 === activeId : overrides[id2];
                    btn.classList.toggle('article-toc__toggle--collapsed', !open);
                    btn.setAttribute('aria-expanded', String(open));
                });
                updateMarker(panel);
            });
            scrollActiveIntoView();
        }

        function updateMarker(panel) {
            var active = $('.article-toc__item--active', panel);
            if (!active) return;
            panel.style.setProperty('--toc-active-marker-y', active.offsetTop + 'px');
            panel.style.setProperty('--toc-active-marker-height', active.offsetHeight + 'px');
            panel.style.setProperty('--toc-active-marker-opacity', '1');
        }

        function scrollActiveIntoView() {
            var panel = !fixedPanel.hidden ? fixedPanel : drawer;
            if (!panel || panel.hidden) return;
            var li = $('.article-toc__item--active', panel);
            var pane = $('.article-toc__list', panel);
            if (!li || !pane) return;
            var liRect = li.getBoundingClientRect();
            var paneRect = pane.getBoundingClientRect();
            var headerH = 56, margin = 12;
            var delta = 0;
            if (liRect.top < paneRect.top + headerH) delta = liRect.top - (paneRect.top + headerH + margin);
            else if (liRect.bottom > paneRect.bottom - margin) delta = liRect.bottom - (paneRect.bottom - margin);
            if (delta) pane.scrollTo({ top: pane.scrollTop + delta, behavior: reducedMotion ? 'auto' : 'smooth' });
        }

        function sectionOpen(id) { return overrides[id] === undefined ? id === activeId : overrides[id]; }

        var scrollRaf = 0;
        function onScrollState() {
            scrollRaf = 0;
            var bRect = body.getBoundingClientRect();
            var bodyActive = bRect.top <= 100 && bRect.bottom > 100;
            var capsuleVisible = bRect.top <= 120;
            var nearFooter = false;
            if (footer) {
                var fRect = footer.getBoundingClientRect();
                var half = fixedPanel && !fixedPanel.hidden ? fixedPanel.offsetHeight / 2 : (scroller.clientHeight - 180) / 2;
                nearFooter = fRect.top - sTop() < scroller.clientHeight / 2 + half + 16;
            }
            var expanded = (bodyActive && panelFits && !userClosed && !nearFooter) || userOpened;
            var showFixed = expanded && panelFits && !nearFooter;
            var showDrawer = expanded && (!panelFits || nearFooter);
            fixedPanel.hidden = !showFixed;
            drawer.hidden = !showDrawer;
            overlayEl.hidden = !showDrawer;
            var showCapsule = capsuleVisible && !showFixed && !showDrawer;
            capsule.style.display = showCapsule ? '' : 'none';
            if (!bodyActive) overrides = {};
            if (showFixed || showDrawer) updateActive();
        }
        function sTop() { return scroller.scrollTop; }
        scroller.addEventListener('scroll', function () {
            if (!scrollRaf) scrollRaf = requestAnimationFrame(onScrollState);
        }, { passive: true });

        var resizeT = 0;
        window.addEventListener('resize', function () {
            clearTimeout(resizeT);
            resizeT = setTimeout(function () { measure(); onScrollState(); }, 100);
        });
        setTimeout(function () { measure(); onScrollState(); }, 80);

        capsule.addEventListener('click', function () { userOpened = true; onScrollState(); });
        closeBtns.forEach(function (b) {
            b.addEventListener('click', function () {
                if (fixedPanel && !fixedPanel.hidden && !userOpened) userClosed = true;
                userOpened = false;
                onScrollState();
            });
        });
        overlayEl.addEventListener('click', function () {
            userOpened = false;
            onScrollState();
        });
        root.addEventListener('click', function (e) {
            var toggle = e.target.closest('.article-toc__toggle');
            if (toggle) {
                var id = toggle.closest('.article-toc__item').getAttribute('data-id');
                overrides[id] = !sectionOpen(id);
                updateActive();
                return;
            }
            var link = e.target.closest('.article-toc__link');
            if (!link) return;
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            var id = link.getAttribute('href').slice(1);
            history.replaceState(null, '', '#' + id);
            if (!fixedPanel.hidden && !panelNearFooter()) { /* 保持展开 */ }
            userOpened = false;
            onScrollState();
            scrollHeading(id);
        });
        function panelNearFooter() {
            if (!footer) return false;
            var fRect = footer.getBoundingClientRect();
            var half = fixedPanel && !fixedPanel.hidden ? fixedPanel.offsetHeight / 2 : (scroller.clientHeight - 180) / 2;
            return fRect.top - sTop() < scroller.clientHeight / 2 + half + 16;
        }
        function scrollHeading(id) {
            var h = doc.getElementById(id);
            if (!h || !scroller) return;
            var rect = h.getBoundingClientRect();
            var sRect = scroller.getBoundingClientRect();
            scroller.scrollTo({ top: scroller.scrollTop + rect.top - sRect.top - 96, behavior: reducedMotion ? 'auto' : 'smooth' });
        }
        function requestIdle(fn) { setTimeout(fn, 80); }
    })();

    /* ---------------- 阅读控制 dock ---------------- */
    (function readingControls() {
        var dock = $('.article-dock');
        var overlay = $('.article-dock__overlay');
        var popover = $('.article-dock__popover');
        if (!dock || !overlay || !popover) return;
        var KEY = 'wakusei:reading-settings';
        var FOCUS_KEY = 'wakusei:focus-mode';
        var FONT_MIN = 0.85, FONT_MAX = 1.3, FONT_STEP = 0.05;
        var settings = { fontScale: 1, lineHeight: 1.8, widthPx: 840 };
        try {
            var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (saved) {
                if (typeof saved.fontScale === 'number') settings.fontScale = Math.min(Math.max(Math.round(saved.fontScale / FONT_STEP) * FONT_STEP, FONT_MIN), FONT_MAX);
                if ([1.6, 1.8, 2.0].indexOf(saved.lineHeight) >= 0) settings.lineHeight = saved.lineHeight;
                if ([720, 840, 960].indexOf(saved.widthPx) >= 0) settings.widthPx = saved.widthPx;
            }
        } catch (e) {}
        var focusMode = false;
        try { focusMode = localStorage.getItem(FOCUS_KEY) === 'true'; } catch (e) {}

        function apply() {
            doc.documentElement.style.setProperty('--article-font-scale', String(settings.fontScale));
            doc.documentElement.style.setProperty('--article-line-height', String(settings.lineHeight));
            doc.documentElement.style.setProperty('--article-width', settings.widthPx + 'px');
            $('.article-dock__popover-value', popover).textContent = Math.round(settings.fontScale * 100) + '%';
            $$('.article-dock__btn--seg', popover).forEach(function (b) {
                var lh = Number(b.getAttribute('data-line-height'));
                var w = Number(b.getAttribute('data-width'));
                var active = (lh && lh === settings.lineHeight) || (w && w === settings.widthPx);
                b.classList.toggle('article-dock__btn--active', active);
                b.setAttribute('aria-pressed', String(active));
            });
            $$('.article-dock__btn--font', popover).forEach(function (b) {
                var step = Number(b.getAttribute('data-font-step'));
                var v = settings.fontScale + step * FONT_STEP;
                b.disabled = v < FONT_MIN - 1e-9 || v > FONT_MAX + 1e-9;
            });
            try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {}
            setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60);
        }
        function applyFocus() {
            doc.documentElement.classList.toggle('is-focus-mode', focusMode);
            var btn = $('.article-dock__btn--focus', popover);
            if (btn) {
                btn.classList.toggle('article-dock__btn--active', focusMode);
                btn.setAttribute('aria-pressed', String(focusMode));
            }
            try { localStorage.setItem(FOCUS_KEY, String(focusMode)); } catch (e) {}
        }
        apply();
        applyFocus();

        var fabTop = $('.article-dock__fab:not(.article-dock__fab--aa)', dock);
        fabTop.addEventListener('click', function () {
            scroller.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        });
        var fabAa = $('.article-dock__fab--aa', dock);
        function openPopover() {
            overlay.hidden = false;
            requestAnimationFrame(function () { popover.classList.add('article-dock__popover--visible'); });
            fabAa.classList.add('article-dock__fab--active');
        }
        function closePopover() {
            popover.classList.remove('article-dock__popover--visible');
            overlay.hidden = true;
            fabAa.classList.remove('article-dock__fab--active');
        }
        fabAa.addEventListener('click', function () { overlay.hidden ? openPopover() : closePopover(); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay || e.target.closest('.article-dock__btn--focus') === null && e.target === overlay) closePopover(); });
        doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) closePopover(); });
        popover.addEventListener('click', function (e) {
            var font = e.target.closest('[data-font-step]');
            if (font) {
                settings.fontScale = Math.min(Math.max(Math.round((settings.fontScale + Number(font.getAttribute('data-font-step')) * FONT_STEP) * 100) / 100, FONT_MIN), FONT_MAX);
                apply();
                return;
            }
            var lh = e.target.closest('[data-line-height]');
            if (lh) { settings.lineHeight = Number(lh.getAttribute('data-line-height')); apply(); return; }
            var w = e.target.closest('[data-width]');
            if (w) { settings.widthPx = Number(w.getAttribute('data-width')); apply(); return; }
            var f = e.target.closest('.article-dock__btn--focus');
            if (f) { focusMode = !focusMode; applyFocus(); closePopover(); }
        });

        var raf = 0;
        scroller.addEventListener('scroll', function () {
            if (raf) return;
            raf = requestAnimationFrame(function () {
                raf = 0;
                var bRect = body.getBoundingClientRect();
                var started = bRect.top <= 120;
                dock.classList.toggle('article-dock--hidden', !(scroller.scrollTop > 0 && started));
            });
        }, { passive: true });
    })();

    /* ---------------- 复制代码 ---------------- */
    (function copyCode() {
        if (!body) return;
        $$('pre', body).forEach(function (pre) {
            if (pre.dataset.copyReady === '1') return;
            pre.dataset.copyReady = '1';
            var wrap = doc.createElement('div');
            wrap.className = 'code-block';
            if (pre.querySelector('code[class*="language-"], code[class*="hljs"]')) {
                var m = /(?:language|hljs)-([\w+-]+)/.exec(pre.querySelector('code').className);
                if (m) wrap.setAttribute('data-lang', m[1]);
            }
            pre.parentNode.insertBefore(wrap, pre);
            wrap.appendChild(pre);
            var btn = doc.createElement('button');
            btn.type = 'button';
            btn.className = 'code-copy';
            btn.setAttribute('aria-label', '复制代码');
            btn.textContent = '复制';
            wrap.appendChild(btn);
        });
        var timers = new Map();
        body.addEventListener('click', function (e) {
            var btn = e.target.closest('.code-copy');
            if (!btn) return;
            var pre = btn.closest('.code-block') && btn.closest('.code-block').querySelector('pre');
            if (!pre) return;
            var text = pre.innerText || pre.textContent || '';
            var done = function () {
                btn.textContent = '已复制';
                btn.classList.add('code-copy--done');
                clearTimeout(timers.get(btn));
                timers.set(btn, setTimeout(function () {
                    btn.textContent = '复制';
                    btn.classList.remove('code-copy--done');
                }, 1600));
            };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
            else {
                var ta = doc.createElement('textarea');
                ta.value = text;
                doc.body.appendChild(ta);
                ta.select();
                try { doc.execCommand('copy'); } catch (err) {}
                doc.body.removeChild(ta);
                done();
            }
        });
    })();

    /* ---------------- 标题深链 ---------------- */
    (function headingLinks() {
        $$(':is(h2,h3,h4,h5)[id]', body).forEach(function (h) {
            if (h.dataset.copyReady === '1') return;
            h.dataset.copyReady = '1';
            var btn = doc.createElement('button');
            btn.type = 'button';
            btn.className = 'heading-copy';
            btn.setAttribute('aria-label', '复制本节链接');
            btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 512 512" aria-hidden="true"><path fill="currentColor" d="M352 256c0 22.2-5.6 43.1-15.4 61.4c10.7 5.8 22.9 9.1 35.9 9.1l.1 0c41.2 0 74.7-33.5 74.7-74.7c0-41.2-33.5-74.7-74.7-74.7l-41.3 0c10.2 24 20.7 47.5 20.7 79.1zM320 96l48 0c69.4 0 125.6 56.2 125.6 125.6c0 69.4-56.2 125.6-125.6 125.6l-.1 0c-29.9 0-57.4-10.5-79-27.9c-13.6 10.9-29.6 18.9-47.1 23.2l-11.5 2.8c-27.2 6.6-53.2 12.9-73.7 25.7c-19.4 12.1-33.9 30-41.6 57.4l-.6 2.4c-4.3 15.4-18.2 26-34.2 26c-21.5 0-38.5-18.2-36.9-39.6c1.3-17.9 4.4-34.4 9.7-49.6L53.6 384c4.9-17.5 13.2-33.3 24.4-46.8c-18-13.5-30.6-34.3-33.7-58.2C40 251.9 33.9 224 33.9 224l-18-72c-1.9-7.6-2.4-15.3-1.6-22.9C16.5 61.1 74.6 0 143.8 0L320 96zM296 512l-.1 0c-27.8 0-53.6-8.4-75.1-22.7c6.5-2.3 12.8-5 18.9-8.1l56.3-69.2z"></path></svg>';
            h.appendChild(btn);
        });
        body.addEventListener('click', function (e) {
            var btn = e.target.closest('.heading-copy');
            if (!btn) return;
            e.preventDefault();
            var h = btn.closest(':is(h2,h3,h4,h5)[id]');
            if (!h) return;
            var url = window.location.origin + window.location.pathname + '#' + h.id;
            var done = function () {
                btn.classList.add('heading-copy--done');
                setTimeout(function () { btn.classList.remove('heading-copy--done'); }, 1600);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
            else done();
        });
    })();

    /* ---------------- 图片灯箱 ---------------- */
    (function lightbox() {
        var images = $$('img', body).filter(function (img) { return !img.closest('a'); });
        images.forEach(function (img) { img.classList.add('lightbox-eligible'); });
        var overlay = null, imgEl = null, captionEl = null;
        var current = 0, warm = {};
        function ensureOverlay() {
            if (overlay) return;
            overlay = doc.createElement('div');
            overlay.className = 'article-lightbox';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', '图片预览');
            overlay.innerHTML =
                '<button class="article-lightbox__close" type="button" aria-label="关闭"><svg width="22" height="22" viewBox="0 0 384 512" aria-hidden="true"><path fill="currentColor" d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"></path></svg></button>' +
                '<button class="article-lightbox__nav article-lightbox__nav--prev" type="button" aria-label="上一张"><svg width="26" height="26" viewBox="0 0 448 512" aria-hidden="true"><path fill="currentColor" d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.2 288 416 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-306.7 0L214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z"></path></svg></button>' +
                '<img class="article-lightbox__img" alt="">' +
                '<p class="article-lightbox__caption"></p>' +
                '<button class="article-lightbox__nav article-lightbox__nav--next" type="button" aria-label="下一张"><svg width="26" height="26" viewBox="0 0 448 512" aria-hidden="true"><path fill="currentColor" d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"></path></svg></button>';
            doc.body.appendChild(overlay);
            imgEl = $('.article-lightbox__img', overlay);
            captionEl = $('.article-lightbox__caption', overlay);
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) close();
                if (e.target.closest('.article-lightbox__close')) close();
                if (e.target.closest('.article-lightbox__nav--prev')) show(current - 1);
                if (e.target.closest('.article-lightbox__nav--next')) show(current + 1);
                if (e.target === imgEl) show(current + 1);
            });
            doc.addEventListener('keydown', function (e) {
                if (overlay.style.display !== 'flex') return;
                if (e.key === 'Escape') close();
                else if (e.key === 'ArrowLeft') show(current - 1);
                else if (e.key === 'ArrowRight') show(current + 1);
            });
        }
        function warmNeighbours(i) {
            [i - 1, i + 1].forEach(function (j) {
                var src = images[(j + images.length) % images.length];
                if (!src || warm[src.src]) return;
                var im = new Image();
                im.onload = function () { try { im.decode(); } catch (e) {} };
                im.src = src.src;
                warm[src.src] = true;
            });
        }
        function show(i) {
            current = (i + images.length) % images.length;
            var src = images[current].src;
            imgEl.src = src;
            captionEl.textContent = images[current].alt || '';
            warmNeighbours(current);
        }
        function open(i) {
            ensureOverlay();
            overlay.style.display = 'flex';
            requestAnimationFrame(function () { overlay.classList.add('article-lightbox--visible'); });
            doc.body.style.overflow = 'hidden';
            show(i);
        }
        function close() {
            overlay.classList.remove('article-lightbox--visible');
            setTimeout(function () {
                overlay.style.display = 'none';
                imgEl.src = '';
            }, reducedMotion ? 0 : 220);
            doc.body.style.overflow = '';
        }
        body.addEventListener('click', function (e) {
            var img = e.target.closest('img.lightbox-eligible');
            if (!img) return;
            var idx = images.indexOf(img);
            if (idx >= 0) open(idx);
        });
    })();

    /* ---------------- Twikoo 评论 + 阅读量 ---------------- */
    (function comments() {
        var host = $('.post-comments__host');
        var viewsEl = $('.post-views');
        if (!host && !viewsEl) return;
        if (!CFG.comments || !CFG.comments.enabled || !CFG.comments.envId) return;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '0.0.0.0') return;
        var api = null;
        function getTwikoo() {
            if (api) return Promise.resolve(api);
            return new Promise(function (resolve, reject) {
                var tries = 0;
                var check = function () {
                    if (window.twikoo && window.twikoo.init) { api = window.twikoo; resolve(api); return; }
                    if (tries++ > 60) { reject(new Error('twikoo not loaded')); return; }
                    setTimeout(check, 200);
                };
                check();
            });
        }
        if (host) {
            var status = $('.post-comments__status', host.closest('.post-comments'));
            if (status) { status.hidden = false; status.textContent = '评论加载中…'; }
            getTwikoo().then(function (tk) {
                tk.init({ envId: CFG.comments.envId, el: host, path: host.getAttribute('data-thread-path') || window.location.pathname, lang: 'zh-CN' });
                if (status) status.hidden = true;
            }).catch(function () {
                if (status) { status.hidden = false; status.setAttribute('role', 'alert'); status.textContent = '评论加载失败,请稍后再试'; }
            });
        }
        if (viewsEl) {
            getTwikoo().then(function (tk) {
                return tk.getVisitorsCount({ envId: CFG.comments.envId, path: viewsEl.getAttribute('data-thread-path') || window.location.pathname });
            }).then(function (result) {
                if (result && typeof result.time === 'number') viewsEl.textContent = result.time + ' 次浏览';
            }).catch(function () {});
        }
    })();
})();
