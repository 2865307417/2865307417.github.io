/* ============================================================
 * Wakusei HomePage · core.js
 * 原生 JS 移植:主题/滚动系统/时钟/跑马灯/社交宫格/壁纸/贡献地形/搜索
 * 对齐原 Astro+Vue 版行为,详见各节注释与原文件对应关系
 * ============================================================ */
(function () {
    'use strict';

    var CFG = window.__WAKUSEI__ || {};
    var doc = document;
    var html = doc.documentElement;
    var $ = function (s, r) { return (r || doc).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var liteMode = html.getAttribute('data-perf') === 'lite';
    var isMobileMQ = window.matchMedia('(max-width: 900px)');
    var scroller = $('#pageScroller') || $('.page-scroller');
    var isHome = !!$('.page-transition-surface[data-is-home]') || doc.body.classList.contains('is-home');

    /* ---------------- 主题切换 ---------------- */
    function applyTheme(t) {
        html.setAttribute('data-theme', t);
        try { localStorage.setItem('theme', t); } catch (e) {}
        var m = $('meta[name="theme-color"]');
        if (m) m.setAttribute('content', t === 'dark' ? '#080808' : (CFG.themeColor || '#fffef7'));
    }
    doc.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action="toggle-theme"]');
        if (!btn) return;
        applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    /* ---------------- 全局滚动状态(hero 3D 下沉 / 顶栏展开 / 跑马灯) ---------------- */
    var marqueeEl = $('.hero-marquee');
    var defocusEl = $('.hero-marquee-defocus');
    var heroContent = $('.hero-content');
    var heroHeader = $('.left-panel .hero');
    var topBar = $('.top-bar');
    var topBarState = { hidden: false };

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    function applyScrollProgress(sp, dir) {
        if (heroContent) {
            if (sp <= 0) {
                heroContent.removeAttribute('style');
            } else if (liteMode) {
                heroContent.style.cssText = 'opacity:' + Math.max(1 - sp * 1.2, 0) + ';';
            } else {
                heroContent.style.cssText = 'transform: translateZ(' + (-600 * sp) + 'px) rotateX(' + (15 * sp) + 'deg) scale(' + (1 - 0.3 * sp) + '); opacity:' + Math.max(1 - sp * 1.2, 0) + ';';
            }
        }
        if (heroHeader) {
            var ho = sp <= 0.15 ? 1 : sp >= 0.4 ? 0 : 1 - (sp - 0.15) / 0.25;
            heroHeader.style.setProperty('--hero-opacity', String(ho));
        }
        if (defocusEl) {
            var dop = sp <= 0.02 ? 1 : sp >= 0.18 ? 0 : 1 - (sp - 0.02) / 0.16;
            defocusEl.style.setProperty('--marquee-defocus-opacity', String(dop));
            defocusEl.classList.toggle('hero-marquee-defocus--scrolled-away', dop <= 0);
        }
        if (topBar) {
            var raw = clamp01((sp - 0.02) / (0.45 - 0.02));
            var eased = 1 - Math.pow(1 - raw, 4);
            topBar.style.setProperty('--bar-left', 'calc(var(--left-panel-width, 500px) * ' + (1 - eased) + ')');
            topBar.style.setProperty('--left-width', 'calc(' + eased + ' * var(--left-panel-width, 500px))');
            var hideNav = sp >= 0.45 && dir === 'down';
            topBar.style.setProperty('--nav-translate-y', hideNav ? '-100%' : '0');
            var showCapsule = isMobileMQ.matches && isHome && sp > 0.35;
            if (showCapsule) topBar.removeAttribute('data-capsule-hidden');
            else topBar.setAttribute('data-capsule-hidden', '');
        }
        if (wallpaper) {
            if (sp >= 1 / 1.2) wallpaper.pause(); else wallpaper.resume();
        }
        if (marqueeCtrl) marqueeCtrl.setScrollPaused(sp >= 0.95);
    }

    function bindScroller() {
        if (!scroller) return;
        var frame = 0, pendingTop = 0, pendingDir = null, lastY = null;
        var flush = function () {
            frame = 0;
            if (pendingDir) { scrollDir = pendingDir; pendingDir = null; }
            applyScrollProgress(Math.min(pendingTop / window.innerHeight, 1), scrollDir);
        };
        var onScroll = function () {
            var cur = scroller.scrollTop;
            if (lastY !== null && cur > lastY) pendingDir = 'down';
            else if (lastY !== null && cur < lastY) pendingDir = 'up';
            lastY = cur;
            pendingTop = cur;
            if (!frame) frame = requestAnimationFrame(flush);
        };
        scroller.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }
    var scrollDir = 'up';

    /* ---------------- 顶栏高斯缩放悬停 ---------------- */
    (function topBarGaussian() {
        if (!topBar || isMobileMQ.matches || reducedMotion) return;
        var raf = 0, lastEvent = null;
        var items = function () {
            return [$('.top-bar-left-content', topBar)].concat($$('.top-bar-dock-item', topBar)).filter(Boolean);
        };
        var apply = function () {
            raf = 0;
            if (!lastEvent) return;
            items().forEach(function (el) {
                var r = el.getBoundingClientRect();
                var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                var dx = lastEvent.clientX - cx, dy = lastEvent.clientY - cy;
                var sigma = el.classList.contains('top-bar-left-content') ? Math.max(30, r.width * 0.45) : 30;
                var max = el.classList.contains('top-bar-left-content') ? 0.035 : 0.12;
                var scale = 1 + max * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
                el.style.transform = scale > 1.001 ? 'scale(' + scale + ')' : '';
            });
        };
        topBar.addEventListener('mousemove', function (e) {
            lastEvent = e;
            if (!raf) raf = requestAnimationFrame(apply);
        });
        topBar.addEventListener('mouseleave', function () {
            lastEvent = null;
            items().forEach(function (el) { el.style.transform = ''; });
        });
    })();

    /* ---------------- 时钟(共享 ticker) ---------------- */
    (function clocks() {
        var widgets = $$('.time-widget');
        if (!widgets.length) return;
        var cfgT = CFG.time || {};
        var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        var MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
        var DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
        function zhDay(d) {
            if (d <= 10) return DIGITS[d] || String(d);
            if (d < 20) return '十' + (d % 10 ? DIGITS[d % 10] : '');
            if (d === 20) return '二十';
            if (d < 30) return '二十' + DIGITS[d % 10];
            if (d === 30) return '三十';
            return '三十' + DIGITS[d % 10];
        }
        function pad2(n) { return String(n).padStart(2, '0'); }
        function tick() {
            var now = new Date();
            widgets.forEach(function (w) {
                var wd = $('.weekday', w), dd = $('.date-display', w), ck = $('.clock', w);
                if (wd) wd.textContent = WEEKDAYS[now.getDay()];
                if (dd) dd.textContent = MONTHS[now.getMonth()] + zhDay(now.getDate()) + '日';
                if (ck) {
                    var h = now.getHours();
                    var suffix = '';
                    if (cfgT.format === '12h') { suffix = h < 12 ? ' AM' : ' PM'; h = h % 12 || 12; }
                    ck.textContent = pad2(h) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds()) + suffix;
                }
            });
        }
        tick();
        setInterval(tick, Math.max(250, Number(cfgT.updateInterval) || 1000));
    })();

    /* ---------------- 摘句轮换 ---------------- */
    (function slogans() {
        var quotes = $$('.hero-ticket--slogan .hero-ticket__quote');
        var list = (CFG.slogans && CFG.slogans.list) || [];
        if (!quotes.length || list.length < 2) return;
        var mode = (CFG.slogans && CFG.slogans.mode) || 'sequence';
        var pause = (CFG.slogans && CFG.slogans.pauseDuration) || 5000;
        var idx = 0;
        function swap() {
            idx = mode === 'random'
                ? (function () { var n; do { n = Math.floor(Math.random() * list.length); } while (list.length > 1 && n === idx); return n; })()
                : (idx + 1) % list.length;
            quotes.forEach(function (q) {
                q.classList.add('hero-ticket-quote-leave-active', 'hero-ticket-quote-leave-to');
                setTimeout(function () {
                    q.textContent = list[idx];
                    q.classList.remove('hero-ticket-quote-leave-active', 'hero-ticket-quote-leave-to');
                    q.classList.add('hero-ticket-quote-enter-active', 'hero-ticket-quote-enter-from');
                    requestAnimationFrame(function () {
                        q.classList.remove('hero-ticket-quote-enter-from');
                        setTimeout(function () { q.classList.remove('hero-ticket-quote-enter-active'); }, 300);
                    });
                }, 180);
            });
        }
        setInterval(swap, pause);
    })();

    /* ---------------- 跑马灯:悬停缓停 / 标签页隐藏暂停 ---------------- */
    var marqueeCtrl = (function () {
        var track = $('.hero-marquee__track');
        if (!track) return null;
        var scrollPaused = false, hoverPaused = false;
        var raf = 0;
        function anim() {
            var a = track.getAnimations && track.getAnimations()[0];
            return a || null;
        }
        function ramp(target, ms) {
            var a = anim();
            if (!a) return;
            cancelAnimationFrame(raf);
            var from = a.playbackRate, start = performance.now();
            if (Math.abs(from - target) < 0.01) { a.playbackRate = target; if (target === 0) a.pause(); return; }
            var step = function (now) {
                var p = clamp01((now - start) / ms);
                p = p * p * (3 - 2 * p);
                a.playbackRate = from + (target - from) * p;
                if (p >= 1) { if (target === 0) a.pause(); return; }
                raf = requestAnimationFrame(step);
            };
            raf = requestAnimationFrame(step);
        }
        function sync() {
            var wantPause = scrollPaused || hoverPaused || doc.hidden || reducedMotion;
            var a = anim();
            if (!a) return;
            if (wantPause) ramp(0, 850);
            else { a.play(); ramp(1, 650); }
        }
        var el = $('.hero-marquee');
        if (el) {
            el.addEventListener('pointerenter', function () { hoverPaused = true; sync(); });
            el.addEventListener('pointerleave', function () { hoverPaused = false; sync(); });
        }
        doc.addEventListener('visibilitychange', sync);
        return { setScrollPaused: function (v) { if (v !== scrollPaused) { scrollPaused = v; sync(); } }, sync: sync };
    })();

    /* ---------------- 社交宫格(翻页/拖拽/滚轮/复制) ---------------- */
    (function social() {
        var wrapper = $('#socialLinks');
        var pageEl = $('#socialLinksPage');
        if (!wrapper || !pageEl) return;
        var slots = $$('.social-link-slot', pageEl).filter(function (s) { return !s.classList.contains('social-link-slot--placeholder'); });
        var PER = 6;
        var pageCount = Math.max(1, Math.ceil(slots.length / PER));
        var current = 0, animKey = 0;
        var dotsBox = $('.social-links-dots', wrapper);
        var live = $('.sr-only[role="status"]', wrapper);

        function showPage(i, dir) {
            var target = Math.max(0, Math.min(pageCount - 1, i));
            if (target === current && dir !== undefined) return;
            dir = target > current ? 'next' : target < current ? 'prev' : dir;
            current = target;
            slots.forEach(function (s, idx) {
                var inPage = idx >= current * PER && idx < (current + 1) * PER;
                s.style.display = inPage ? '' : 'none';
            });
            $$('.social-link-slot', pageEl).forEach(function (s) { s.classList.remove('is-hovered'); });
            if (dir) {
                animKey += 1;
                pageEl.classList.remove('is-swap-fade', 'is-animation-alt');
                void pageEl.offsetWidth;
                pageEl.classList.add('is-swap-fade');
                if (animKey % 2 === 1) pageEl.classList.add('is-animation-alt');
            }
            pageEl.setAttribute('data-page-key', String(animKey));
            if (dotsBox) {
                $$('.social-link-dot', dotsBox).forEach(function (d, di) {
                    d.classList.toggle('active', di === current);
                    if (di === current) d.setAttribute('aria-current', 'true');
                    else d.removeAttribute('aria-current');
                });
            }
        }
        if (dotsBox && pageCount > 1) {
            dotsBox.addEventListener('click', function (e) {
                var dot = e.target.closest('.social-link-dot');
                if (!dot) return;
                var dots = $$('.social-link-dot', dotsBox);
                showPage(dots.indexOf(dot));
            });
        }
        showPage(0);

        /* 拖拽翻页 */
        var drag = null;
        wrapper.addEventListener('pointerdown', function (e) {
            if (e.target.closest('a, button, [role="button"]')) return;
            drag = { x: e.clientX, y: e.clientY, moved: false };
        });
        wrapper.addEventListener('pointermove', function (e) {
            if (!drag) return;
            var dx = e.clientX - drag.x;
            if (!drag.moved && Math.abs(dx) >= 6) drag.moved = true;
            if (drag.moved) e.preventDefault();
        });
        wrapper.addEventListener('pointerup', function (e) {
            if (!drag) return;
            var dx = e.clientX - drag.x;
            var d = drag; drag = null;
            if (!d.moved || Math.abs(dx) < 36) return;
            suppressClick = true;
            setTimeout(function () { suppressClick = false; }, 300);
            showPage(current + (dx < 0 ? 1 : -1));
        });
        wrapper.addEventListener('pointercancel', function () { drag = null; });
        var suppressClick = false;
        wrapper.addEventListener('click', function (e) {
            if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
        }, true);

        /* 滚轮翻页 */
        var wheelLock = 0;
        wrapper.addEventListener('wheel', function (e) {
            if (pageCount <= 1) return;
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            var now = Date.now();
            if (now < wheelLock) return;
            var dir = e.deltaY > 0 ? 1 : -1;
            var target = current + dir;
            if (target < 0 || target >= pageCount) return;
            e.preventDefault();
            wheelLock = now + 450;
            showPage(target);
        }, { passive: false });

        /* 复制链接 */
        function toast(slot, link) {
            var t = doc.createElement('div');
            t.className = 'social-link-toast';
            t.setAttribute('role', 'tooltip');
            t.setAttribute('aria-hidden', 'true');
            t.innerHTML = '<div class="social-link-toast__header">' +
                '<svg class="svg-icon social-link-toast__icon" viewBox="0 0 448 512" width="0.85rem" height="0.85rem" aria-hidden="true" style="display:inline-block;flex-shrink:0"><path fill="currentColor" d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"></path></svg>' +
                '<span class="social-link-toast__title">已复制订阅地址</span></div>' +
                '<p class="social-link-toast__hint">粘贴到阅读器即可订阅</p>';
            slot.appendChild(t);
            slot.classList.add('is-copied');
            requestAnimationFrame(function () {
                t.classList.add('social-toast-enter-active');
                t.classList.remove('social-toast-enter-from');
            });
            if (live) live.textContent = '已复制';
            setTimeout(function () {
                slot.classList.remove('is-copied');
                if (t.parentNode) t.parentNode.removeChild(t);
                if (live) live.textContent = '';
            }, 2400);
        }
        wrapper.addEventListener('click', function (e) {
            var a = e.target.closest('a.social-link--custom[data-copy]');
            if (!a) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            var url = a.getAttribute('href');
            if (!/^https?:/i.test(url)) url = window.location.origin + url;
            var slot = a.closest('.social-link-slot');
            slot.classList.remove('is-hovered');
            var done = function () { toast(slot, a); };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(done, done);
            } else {
                var ta = doc.createElement('textarea');
                ta.value = url;
                doc.body.appendChild(ta);
                ta.select();
                try { doc.execCommand('copy'); } catch (err) {}
                doc.body.removeChild(ta);
                done();
            }
        });
    })();

    /* ---------------- 进场动效(scroll-reveal) ---------------- */
    (function reveal() {
        var cfgE = CFG.effects && CFG.effects.scrollReveal;
        if (!cfgE || cfgE.enabled === false || reducedMotion) return;
        var delay = Number(cfgE.delay) || 50;
        var offset = Number(cfgE.offset) || 50;
        var targets = $$('.social-link, .avatar-box, .name, .status-bar, .post-card.scroll-reveal');
        if (!targets.length) return;
        if (!('IntersectionObserver' in window)) return;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                show(entry.target);
            });
        }, { rootMargin: '0px 0px -' + offset + 'px 0px', threshold: 0.1 });
        function show(el) {
            if (el.__revealed) return;
            el.__revealed = true;
            el.classList.add('scroll-reveal--visible');
            io.unobserve(el);
            var cleanup = function () { el.classList.remove('scroll-reveal'); };
            el.addEventListener('transitionend', cleanup, { once: true });
            setTimeout(cleanup, 900);
        }
        targets.forEach(function (el, i) {
            el.classList.add('scroll-reveal');
            el.style.transitionDelay = (i % 10) * delay + 'ms';
            io.observe(el);
            /* 已在视口内的元素立即显示(IO 在部分环境下可能不触发) */
            var r = el.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0) show(el);
        });
        /* 兜底:2.5s 后强制显示仍未触发的元素,保证内容永远可见 */
        setTimeout(function () {
            targets.forEach(function (el) { if (!el.__revealed) show(el); });
        }, 2500);
    })();

    /* ---------------- 移动端滚动后头像缩小 ---------------- */
    (function stickyAvatar() {
        var avatar = $('#avatarBox');
        if (!avatar || !scroller) return;
        scroller.addEventListener('scroll', function () {
            if (!isMobileMQ.matches) { avatar.classList.remove('scrolled'); return; }
            avatar.classList.toggle('scrolled', scroller.scrollTop > 50);
        }, { passive: true });
    })();

    /* ---------------- 壁纸控制器(双槽交叉淡化 + Ken Burns + 轮换) ---------------- */
    var wallpaper = (function () {
        var area = $('.wallpaper-scroll-area');
        if (!area || isMobileMQ.matches) return { pause: function () {}, resume: function () {} };
        var cfgW = CFG.wallpaper || {};
        var layers = [];
        var activeLayer = -1;
        var rotationIdx = 0;
        var rotTimer = 0;
        var paused = false;
        var failedRotations = 0;
        var preloading = false;
        var pendingSwap = false;
        var rotationEnabled = cfgW.rotation && cfgW.rotation.enabled && !liteMode && !reducedMotion;
        var interval = (cfgW.rotation && cfgW.rotation.interval) || 8000;

        function makeLayer() {
            var img = doc.createElement('img');
            img.className = 'wallpaper-image';
            img.alt = '';
            img.decoding = 'async';
            area.appendChild(img);
            return img;
        }
        layers.push(makeLayer(), makeLayer());

        function glassTints(img) {
            if (liteMode) return;
            try {
                var c = doc.createElement('canvas');
                c.width = 32; c.height = 18;
                var ctx = c.getContext('2d', { willReadFrequently: true });
                if (!ctx) return;
                var iw = img.naturalWidth, ih = img.naturalHeight;
                if (!iw || !ih) return;
                var scale = Math.max(c.width / iw, c.height / ih);
                var dw = iw * scale, dh = ih * scale;
                ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
                var sample = function (x, y, w, h) {
                    var data = ctx.getImageData(x, y, w, h).data;
                    var r = 0, g = 0, b = 0, n = 0;
                    for (var i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
                    return Math.round(r / n) + ' ' + Math.round(g / n) + ' ' + Math.round(b / n);
                };
                var root = $('.hero-sticky') || html;
                root.style.setProperty('--glass-panel-tint', sample(0, 0, Math.round(c.width * 0.4), c.height));
                root.style.setProperty('--glass-bed-tint', sample(0, Math.round(c.height * 0.6), c.width, Math.round(c.height * 0.4)));
            } catch (e) { /* 画布污染则保留旧 tint */ }
        }

        function kenBurns(el, phase) {
            if (reducedMotion || liteMode) { el.style.transform = 'scale(1)'; return; }
            if (rotationEnabled) {
                var a = el.animate([
                    { transform: 'scale(1)' },
                    { transform: 'scale(1.1)' },
                    { transform: 'scale(1)' }
                ], { duration: interval, iterations: Infinity, easing: 'cubic-bezier(0.37, 0, 0.63, 1)' });
                if (phase && a.currentTime !== undefined) a.currentTime = phase;
            } else {
                el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }], { duration: 90000, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'forwards' });
            }
        }

        function activate(i) {
            var el = layers[i];
            void el.offsetWidth;
            el.classList.add('active');
            layers.forEach(function (l, j) { if (j !== i) l.classList.remove('active'); });
            activeLayer = i;
            glassTints(el);
        }

        function loadInto(slot, url) {
            return new Promise(function (resolve, reject) {
                var img = new Image();
                img.crossOrigin = 'anonymous';
                var timer = setTimeout(function () { reject(new Error('timeout')); }, cfgW.raceTimeout || 10000);
                img.onload = function () { clearTimeout(timer); resolve(img.src); };
                img.onerror = function () { clearTimeout(timer); reject(new Error('load')); };
                img.src = url;
            });
        }

        function nextUrl() {
            var apis = (cfgW.apis || []).filter(Boolean);
            if (!apis.length) return null;
            var api = apis[rotationIdx % apis.length];
            rotationIdx += 1;
            return api + (api.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now() + '_' + rotationIdx;
        }

        function swap() {
            var next = (activeLayer + 1) % layers.length;
            var url = nextUrl();
            var phase = 0;
            var cur = layers[activeLayer] && layers[activeLayer].getAnimations ? layers[activeLayer].getAnimations()[0] : null;
            if (cur && cur.currentTime) phase = cur.currentTime;
            var p = loadInto(next, url);
            p.then(function () {
                failedRotations = 0;
                layers[next].src = url;
                layers[next].onload = function () {
                    activate(next);
                    kenBurns(layers[next], phase);
                };
                rotTimer = setTimeout(rotationLoop, interval);
            }).catch(function () {
                failedRotations += 1;
                if (failedRotations >= 2) return; /* 放弃轮换 */
                rotTimer = setTimeout(rotationLoop, interval);
            });
        }

        function rotationLoop() {
            if (paused || doc.hidden) { pendingSwap = true; return; }
            swap();
        }

        function init() {
            var first = null;
            if (window.__wallpaperPrefetch && window.__wallpaperPrefetch.img) first = window.__wallpaperPrefetch.img.src;
            if (!first) first = cfgW.defaultImage;
            layers[0].src = first;
            var done = function () { activate(0); kenBurns(layers[0], 0); if (rotationEnabled) rotTimer = setTimeout(rotationLoop, interval); };
            if (layers[0].complete && layers[0].naturalWidth) done();
            else {
                layers[0].onload = done;
                layers[0].onerror = done;
                /* 兜底:onload 在个别环境下不触发也要让壁纸显形 */
                setTimeout(function () {
                    if (activeLayer < 0 && layers[0].naturalWidth) done();
                    else if (activeLayer < 0) activate(0);
                }, 3000);
            }
        }
        init();
        doc.addEventListener('visibilitychange', function () {
            if (doc.hidden) { clearTimeout(rotTimer); }
            else if (pendingSwap && rotationEnabled && !paused) { pendingSwap = false; rotTimer = setTimeout(swap, 400); }
        });
        return {
            pause: function () { paused = true; },
            resume: function () { paused = false; }
        };
    })();

    /* ---------------- GitHub 贡献地形(canvas) ---------------- */
    (function contributions() {
        var root = $('.github-contrib');
        if (!root) return;
        var canvas = $('.github-contrib__canvas', root);
        var countEl = $('.github-contrib__count', root);
        var messageEl = $('.github-contrib__message', root);
        if (!canvas) return;

        var GEO = { u: [5.2, 0.45], v: [-2.4, 1.3], maxHeight: 30, floorHeight: 0.5, inset: 0.04, sigma: [2.4, 1.8], sharpness: 0.18, plinthDepth: 2.5, padding: 3 };
        var WEEKS = 53, DAYS = 7, TONE_FLOOR = 0.03, RAMP_STEPS = 24, GLOW_TONE = 0.85;
        var RISE_DURATION = 650, RISE_SPREAD = 900, COUNT_DURATION = RISE_SPREAD + RISE_DURATION;

        function buildGrid(days) {
            var map = {};
            (days || []).forEach(function (d) { map[d.date] = d; });
            var today = new Date();
            var iso = function (d) {
                return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            };
            var dow = today.getDay();
            var sow = new Date(today);
            sow.setDate(today.getDate() - dow);
            var start = new Date(sow);
            start.setDate(sow.getDate() - (WEEKS - 1) * 7);
            var weeks = [], totalCount = 0;
            for (var w = 0; w < WEEKS; w++) {
                var col = [];
                for (var d = 0; d < DAYS; d++) {
                    var dt = new Date(start);
                    dt.setDate(start.getDate() + w * 7 + d);
                    if (dt > today) { col.push(null); continue; }
                    var cell = map[iso(dt)] || { count: 0, level: 0 };
                    totalCount += cell.count;
                    col.push({ date: iso(dt), count: cell.count, level: cell.level });
                }
                weeks.push(col);
            }
            return { weeks: weeks, totalCount: totalCount, startDate: iso(start), endDate: iso(today) };
        }

        function planePoint(w, d) { return [w * GEO.u[0] + d * GEO.v[0], w * GEO.u[1] + d * GEO.v[1]]; }
        function bounds() {
            var cs = [planePoint(0, 0), planePoint(WEEKS, 0), planePoint(0, DAYS), planePoint(WEEKS, DAYS)];
            var xs = cs.map(function (p) { return p[0]; }), ys = cs.map(function (p) { return p[1]; });
            var minX = Math.min.apply(null, xs), minY = Math.min.apply(null, ys) - GEO.maxHeight;
            var maxX = Math.max.apply(null, xs), maxY = Math.max.apply(null, ys) + GEO.plinthDepth;
            return { ox: GEO.padding - minX, oy: GEO.padding - minY, width: maxX - minX + GEO.padding * 2, height: maxY - minY + GEO.padding * 2 };
        }
        function terrainTones(grid) {
            var raw = grid.weeks.map(function (week) { return week.map(function (c) { return Math.sqrt(Math.max(c ? c.count : 0, 0)); }); });
            var sw = GEO.sigma[0], sd = GEO.sigma[1];
            var rw = Math.ceil(sw * 2.5), rd = Math.ceil(sd * 2.5);
            var blurred = raw.map(function (week, w) {
                return week.map(function (_, d) {
                    var sum = 0, weight = 0;
                    for (var dw = -rw; dw <= rw; dw++) {
                        var col = raw[w + dw];
                        if (!col) continue;
                        for (var dd = -rd; dd <= rd; dd++) {
                            var value = col[d + dd];
                            if (value === undefined) continue;
                            var k = Math.exp(-(dw * dw) / (2 * sw * sw) - (dd * dd) / (2 * sd * sd));
                            sum += value * k; weight += k;
                        }
                    }
                    return weight > 0 ? sum / weight : 0;
                });
            });
            var mix = raw.map(function (week, w) { return week.map(function (v, d) { return GEO.sharpness * v + (1 - GEO.sharpness) * blurred[w][d]; }); });
            var max = 0;
            mix.forEach(function (week) { week.forEach(function (v) { if (v > max) max = v; }); });
            return mix.map(function (week) { return week.map(function (v) { return max > 0 ? v / max : 0; }); });
        }
        function barHeight(tone) {
            if (!(tone > TONE_FLOOR)) return GEO.floorHeight;
            return GEO.floorHeight + Math.pow(Math.min(tone, 1), 0.8) * (GEO.maxHeight - GEO.floorHeight);
        }
        function layoutSkyline(grid) {
            var b = bounds();
            var shift = function (p) { return [p[0] + b.ox, p[1] + b.oy]; };
            var tones = terrainTones(grid);
            var lastWeek = grid.weeks.length - 1;
            var lastDay = lastWeek >= 0 ? grid.weeks[lastWeek].length - 1 : -1;
            var diagonal = Math.max(WEEKS + DAYS - 2, 1);
            var lo = GEO.inset, hi = 1 - GEO.inset;
            var bars = [];
            for (var day = 0; day < DAYS; day++) {
                for (var week = 0; week < grid.weeks.length; week++) {
                    var cell = grid.weeks[week][day];
                    if (!cell) continue;
                    bars.push({
                        tone: tones[week][day],
                        isToday: week === lastWeek && day === lastDay,
                        height: barHeight(tones[week][day]),
                        base: [
                            shift(planePoint(week + lo, day + lo)),
                            shift(planePoint(week + hi, day + lo)),
                            shift(planePoint(week + hi, day + hi)),
                            shift(planePoint(week + lo, day + hi))
                        ],
                        delay: (week + day) / diagonal
                    });
                }
            }
            var center = shift(planePoint(WEEKS / 2, DAYS / 2));
            return {
                bars: bars, width: b.width, height: b.height,
                plinth: [shift(planePoint(0, 0)), shift(planePoint(WEEKS, 0)), shift(planePoint(WEEKS, DAYS)), shift(planePoint(0, DAYS))],
                plinthDepth: GEO.plinthDepth,
                groundCenter: [center[0], center[1] + GEO.plinthDepth],
                groundRadius: [(WEEKS * GEO.u[0]) / 2 + DAYS * 2, DAYS * GEO.v[1] + WEEKS * GEO.u[1] * 0.5]
            };
        }
        function parseColor(input) {
            var v = String(input).trim();
            var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
            if (hex) {
                var raw = hex[1].length === 3 ? hex[1].split('').map(function (c) { return c + c; }).join('') : hex[1];
                return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16), 1];
            }
            var rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(v);
            if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
            return null;
        }
        function mixColor(a, b, t) {
            var ca = parseColor(a), cb = parseColor(b);
            if (!ca || !cb) return b;
            var k = clamp01(t);
            var out = ca.map(function (v, i) { return v + (cb[i] - v) * k; });
            return 'rgba(' + Math.round(out[0]) + ', ' + Math.round(out[1]) + ', ' + Math.round(out[2]) + ', ' + Number(out[3].toFixed(3)) + ')';
        }
        function rampColor(stops, t) {
            if (!stops.length) return 'transparent';
            if (stops.length === 1) return stops[0];
            var x = clamp01(t) * (stops.length - 1);
            var i = Math.min(Math.floor(x), stops.length - 2);
            return mixColor(stops[i], stops[i + 1], x - i);
        }
        function shade(color, factor) {
            var p = parseColor(color);
            if (!p) return color;
            var ch = function (n) { return Math.round(Math.min(Math.max(n * factor, 0), 255)); };
            return 'rgba(' + ch(p[0]) + ', ' + ch(p[1]) + ', ' + ch(p[2]) + ', ' + p[3] + ')';
        }
        function easeOutBack(t) {
            var c1 = 1.4, c3 = c1 + 1, x = clamp01(t) - 1;
            return 1 + c3 * x * x * x + c1 * x * x;
        }
        function easeOutCubic(t) { var x = 1 - clamp01(t); return 1 - x * x * x; }

        var zeroGrid = { weeks: Array.apply(null, Array(WEEKS)).map(function () { return Array.apply(null, Array(DAYS)).map(function (_, d) { return { count: 0, level: 0, date: '' }; }); }), totalCount: 0 };
        var layout = layoutSkyline(zeroGrid);
        var palette = null;
        var animationStart = 0, animating = false, frameId = 0;

        function faces(color) { return { top: color, front: shade(color, 0.8), right: shade(color, 0.62) }; }
        function readPalette() {
            var style = getComputedStyle(root);
            var read = function (name, fb) { var v = style.getPropertyValue(name).trim(); return v || fb; };
            var stops = [read('--github-l1', '#9be9a8'), read('--github-l2', '#40c463'), read('--github-l3', '#30a14e'), read('--github-l4', '#216e39')];
            return {
                flat: faces(read('--github-l0', 'rgba(0, 0, 0, 0.06)')),
                ramp: Array.apply(null, Array(RAMP_STEPS + 1)).map(function (_, i) { return faces(rampColor(stops, i / RAMP_STEPS)); }),
                today: faces(read('--accent-yellow', '#ffe600')),
                plinth: faces(read('--github-plinth', '#e6e3da')),
                glow: read('--github-glow', 'rgba(64, 196, 99, 0.45)'),
                ground: read('--github-ground', 'rgba(0, 0, 0, 0.08)')
            };
        }
        function polygon(ctx, points, fill) {
            ctx.beginPath();
            ctx.moveTo(points[0][0], points[0][1]);
            for (var i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
        }
        function draw(elapsed) {
            var ctx = canvas.getContext('2d');
            if (!ctx || !palette || canvas.width === 0) return false;
            var dpr = window.devicePixelRatio || 1;
            var scale = canvas.width / layout.width;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            var cx = layout.groundCenter[0], cy = layout.groundCenter[1];
            var rx = layout.groundRadius[0], ry = layout.groundRadius[1];
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1, ry / rx);
            var ground = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
            ground.addColorStop(0, palette.ground);
            ground.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = ground;
            ctx.beginPath();
            ctx.arc(0, 0, rx, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            var pBack = layout.plinth[0], pRight = layout.plinth[1], pFront = layout.plinth[2], pLeft = layout.plinth[3];
            var down = function (p) { return [p[0], p[1] + layout.plinthDepth]; };
            polygon(ctx, [pLeft, pFront, down(pFront), down(pLeft)], palette.plinth.front);
            polygon(ctx, [pRight, pFront, down(pFront), down(pRight)], palette.plinth.right);
            polygon(ctx, [pBack, pRight, pFront, pLeft], palette.plinth.top);
            var running = false;
            var floor = GEO.floorHeight;
            layout.bars.forEach(function (bar) {
                var progress = (elapsed - bar.delay * RISE_SPREAD) / RISE_DURATION;
                if (progress < 1) running = true;
                var grow = progress <= 0 ? 0 : easeOutBack(progress);
                var h = Math.max(floor + (bar.height - floor) * grow, floor * 0.5);
                var back = bar.base[0], right = bar.base[1], front = bar.base[2], left = bar.base[3];
                var up = function (p) { return [p[0], p[1] - h]; };
                var colors = bar.isToday ? palette.today : bar.tone > TONE_FLOOR ? palette.ramp[Math.round(Math.min(bar.tone, 1) * RAMP_STEPS)] : palette.flat;
                polygon(ctx, [left, front, up(front), up(left)], colors.front);
                polygon(ctx, [right, front, up(front), up(right)], colors.right);
                var glowing = bar.tone >= GLOW_TONE || bar.isToday;
                if (glowing) { ctx.shadowColor = bar.isToday ? colors.top : palette.glow; ctx.shadowBlur = 8 * dpr; }
                polygon(ctx, [up(back), up(right), up(front), up(left)], colors.top);
                if (glowing) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
            });
            return running;
        }
        function tickFn(now) {
            var running = draw(now - animationStart);
            if (running) frameId = requestAnimationFrame(tickFn);
            else animating = false;
        }
        function startRise() {
            cancelAnimationFrame(frameId);
            if (reducedMotion) { animating = false; draw(Infinity); return; }
            animating = true;
            animationStart = performance.now();
            frameId = requestAnimationFrame(tickFn);
        }
        function resizeCanvas() {
            var cssWidth = canvas.clientWidth;
            if (!cssWidth) return;
            var dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(cssWidth * dpr);
            canvas.height = Math.round((cssWidth * layout.height / layout.width) * dpr);
            if (!animating) draw(Infinity);
        }
        function refreshPalette() {
            palette = readPalette();
            if (!animating) draw(Infinity);
        }

        palette = readPalette();
        resizeCanvas();
        if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeCanvas).observe(canvas);
        new MutationObserver(refreshPalette).observe(html, { attributes: true, attributeFilter: ['data-theme'] });

        fetch(CFG.contributionsUrl || 'github-contributions.json')
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (payload) {
                var grid = buildGrid(payload.contributions);
                layout = layoutSkyline(grid);
                root.classList.remove('github-contrib--loading');
                root.classList.add('github-contrib--ready');
                if (countEl) countEl.hidden = false;
                var shown = 0;
                var countStart = performance.now();
                if (!reducedMotion && countEl) {
                    var step = function (now) {
                        shown = Math.round(grid.totalCount * easeOutCubic((now - countStart) / COUNT_DURATION));
                        countEl.textContent = String(shown);
                        if (now - countStart < COUNT_DURATION) requestAnimationFrame(step);
                        else countEl.textContent = String(grid.totalCount);
                    };
                    requestAnimationFrame(step);
                } else if (countEl) countEl.textContent = String(grid.totalCount);
                root.setAttribute('aria-label', (CFG.profile && CFG.githubUsername) || '');
                startRise();
            })
            .catch(function () {
                root.classList.remove('github-contrib--loading');
                root.classList.add('github-contrib--error');
                if (messageEl) messageEl.hidden = false;
            });
    })();

    /* ---------------- 瀑布流列序(单列恢复阅读序) ---------------- */
    (function masonry() {
        var MQ = window.matchMedia('(max-width: 768px)');
        $$('.post-list--masonry').forEach(function (list) {
            var cards = $$('.post-card', list);
            if (!cards.length) return;
            cards.forEach(function (c, i) { c.setAttribute('data-masonry-index', String(i)); });
            var apply = function () {
                var single = MQ.matches;
                var n = single ? 1 : 2;
                var order = [];
                for (var col = 0; col < n; col++) {
                    for (var i = col; i < cards.length; i += n) order.push(cards[i]);
                }
                order.forEach(function (c) { list.appendChild(c); });
            };
            apply();
            if (MQ.addEventListener) MQ.addEventListener('change', apply);
            else MQ.addListener(apply);
        });
    })();

    /* ---------------- hash 区块定位 ---------------- */
    (function hashNav() {
        function scrollToHash(hash) {
            if (!hash || hash === '#') return;
            var el = doc.getElementById(hash.slice(1));
            if (!el || !scroller) return;
            var rect = el.getBoundingClientRect();
            var sRect = scroller.getBoundingClientRect();
            scroller.scrollTo({ top: scroller.scrollTop + rect.top - sRect.top, behavior: 'smooth' });
        }
        if (window.location.hash && window.location.pathname.replace(/\/+$/, '') === (CFG.root || '').replace(/\/+$/, '')) {
            setTimeout(function () { scrollToHash(window.location.hash); }, 60);
        }
        doc.addEventListener('click', function (e) {
            var a = e.target.closest('a[href*="#"]');
            if (!a) return;
            var href = a.getAttribute('href') || '';
            var m = /^\/?#(.+)$/.exec(href);
            var isInternalHash = href.indexOf('#') === 0 || (m && window.location.pathname === a.pathname);
            if (!isInternalHash) return;
            e.preventDefault();
            scrollToHash(href.slice(href.indexOf('#')));
            history.replaceState(null, '', href.slice(href.indexOf('#')) === '' ? href : href);
        });
    })();

    /* ============================================================
     * 搜索(弹窗 + 整页)
     * 打分逻辑对齐 lib/search.ts:token 须全部命中;title 30 / desc 15 / body 5
     * ============================================================ */
    var search = (function () {
        var indexPromise = null;
        function loadIndex() {
            if (!indexPromise) {
                indexPromise = fetch(CFG.searchIndexUrl || 'search-index.json').then(function (r) {
                    if (!r.ok) throw new Error(r.status);
                    return r.json();
                });
            }
            return indexPromise;
        }
        function normalize(s) {
            return String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
        }
        function getScore(entry, tokens, cached) {
            var title = cached.t, desc = cached.d, body = cached.b;
            var score = 0;
            for (var i = 0; i < tokens.length; i++) {
                var tok = tokens[i];
                var inTitle = title.indexOf(tok) >= 0;
                var inDesc = desc.indexOf(tok) >= 0;
                var inBody = body.indexOf(tok) >= 0;
                if (!inTitle && !inDesc && !inBody) return -1;
                if (inTitle) score += 30;
                if (inDesc) score += 15;
                if (inBody) score += 5;
            }
            return score;
        }
        function searchPosts(entries, query) {
            var tokens = normalize(query).split(' ').filter(Boolean);
            var uniq = tokens.filter(function (t, i) { return tokens.indexOf(t) === i; });
            var results = [];
            entries.forEach(function (entry) {
                var cached = {
                    t: normalize([entry.data.title, (entry.data.tags || []).join(' ')].join(' ')),
                    d: normalize(entry.data.description),
                    b: normalize(entry.bodyText)
                };
                var score = uniq.length ? getScore(entry, uniq, cached) : 0;
                if (score < 0) return;
                results.push({ entry: entry, score: score, tokens: uniq, cached: cached });
            });
            results.sort(function (a, b) {
                if (b.score !== a.score) return b.score - a.score;
                if (b.entry.publishedAt !== a.entry.publishedAt) return b.entry.publishedAt - a.entry.publishedAt;
                return String(a.entry.slug || a.entry.url).localeCompare(String(b.entry.slug || b.entry.url), 'zh-CN');
            });
            return results;
        }
        function snippet(result) {
            var e = result.entry;
            var tokens = result.tokens;
            var source = e.data.description || e.bodyText || '';
            var label = e.data.description ? '描述' : '正文';
            if (!tokens.length || !source) return { label: label, html: escapeHtml(source.slice(0, 120)) };
            var norm = normalize(source);
            var pos = -1;
            for (var i = 0; i < tokens.length; i++) {
                pos = norm.indexOf(tokens[i]);
                if (pos >= 0) break;
            }
            if (pos < 0) return { label: label, html: escapeHtml(source.slice(0, 120)) };
            var R = 52;
            var start = Math.max(0, pos - R), end = Math.min(source.length, pos + R);
            var prefix = start > 0 ? '…' : '', suffix = end < source.length ? '…' : '';
            var re = new RegExp('(' + tokens.map(escapeRegExp).join('|') + ')', 'gi');
            var mid = escapeHtml(source.slice(start, end)).replace(re, '<mark>$1</mark>');
            return { label: label, html: prefix + mid + suffix };
        }
        function escapeHtml(s) {
            return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

        function resultNode(result) {
            var e = result.entry;
            var node = doc.createElement('article');
            node.className = 'search-result';
            node.setAttribute('role', 'link');
            node.setAttribute('tabindex', '0');
            node.setAttribute('data-url', e.url);
            var minutes = Math.max(1, Math.round((e.wordCount || 0) / 300));
            var meta = [];
            if (e.dateLabel) meta.push('<time>' + escapeHtml(e.dateLabel) + '</time><span class="meta-separator">·</span>');
            meta.push('<span>' + minutes + ' 分钟阅读</span>');
            if (e.data.category) meta.push('<span class="meta-separator">·</span><span class="post-category">' + escapeHtml(e.data.category) + '</span>');
            var sn = snippet(result);
            node.innerHTML =
                '<a class="post-card post-card--below" href="' + escapeHtml(e.url) + '">' +
                '<div class="post-info"><div class="post-meta">' + meta.join('') + '</div>' +
                '<h3 class="post-title">' + escapeHtml(e.data.title) + '</h3>' +
                '<p class="post-desc">' + escapeHtml(e.data.description || '') + '</p></div></a>' +
                '<div class="search-snippet"><span class="search-snippet__label">' + sn.label + '</span><p>' + sn.html + '</p></div>';
            return node;
        }

        /* ---- 弹窗 ---- */
        var overlay = $('#searchModal');
        var modalInput = $('#search-modal-input');
        var modalResults = overlay ? $('.search-results', overlay) : null;
        var modalSummary = overlay ? $('.search-summary', overlay) : null;
        var modalEmpty = overlay ? $('.search-empty', overlay) : null;
        var modalLoading = overlay ? $('.search-loading', overlay) : null;
        var modalClear = overlay ? $('.search-clear', overlay) : null;
        var previousFocus = null;
        var selectedIndex = 0;
        var lastResults = [];

        function openModal() {
            if (!overlay) return;
            previousFocus = doc.activeElement;
            overlay.hidden = false;
            doc.body.style.overflow = 'hidden';
            loadIndex().catch(function () {});
            setTimeout(function () { if (modalInput) modalInput.focus(); }, 30);
            if (modalInput && modalInput.value) runModal(modalInput.value);
        }
        function closeModal() {
            if (!overlay) return;
            overlay.hidden = true;
            doc.body.style.overflow = '';
            if (previousFocus && previousFocus.focus) previousFocus.focus();
        }
        function updateModal(results, query) {
            lastResults = results;
            selectedIndex = 0;
            if (!modalResults) return;
            modalResults.innerHTML = '';
            var hasQuery = !!query;
            if (modalLoading) modalLoading.hidden = true;
            if (modalSummary) {
                modalSummary.hidden = !hasQuery;
                if (hasQuery) {
                    $('span', modalSummary).textContent = results.length + ' 条结果';
                    $$('span', modalSummary)[1].textContent = query;
                }
            }
            if (modalEmpty) modalEmpty.hidden = !(hasQuery && !results.length);
            results.slice(0, 40).forEach(function (r) {
                var node = resultNode(r);
                if (!modalResults.children.length) node.classList.add('search-result--selected');
                modalResults.appendChild(node);
            });
            if (modalClear) modalClear.hidden = !hasQuery;
        }
        function runModal(query) {
            if (!query) { updateModal([], ''); return; }
            loadIndex().then(function (entries) {
                updateModal(searchPosts(entries, query), query);
            }).catch(function () {
                if (modalLoading) modalLoading.hidden = true;
                if (modalEmpty) { modalEmpty.hidden = false; $('p', modalEmpty).textContent = '索引加载失败'; }
            });
        }
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closeModal();
                var result = e.target.closest('.search-result');
                if (result && result.getAttribute('data-url')) {
                    window.location.href = result.getAttribute('data-url');
                }
            });
            overlay.addEventListener('click', function (e) {
                if (e.target.closest('.search-view-all-link')) {
                    var q = modalInput ? modalInput.value.trim() : '';
                    window.location.href = (CFG.searchPageUrl || 'search/') + (q ? '?q=' + encodeURIComponent(q) : '');
                }
            });
            if (modalInput) {
                modalInput.addEventListener('input', function () { runModal(modalInput.value.trim()); });
                modalInput.addEventListener('keydown', function (e) {
                    if (e.key === 'Escape') {
                        if (modalInput.value) { modalInput.value = ''; runModal(''); }
                        else closeModal();
                    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (!lastResults.length) return;
                        var delta = e.key === 'ArrowDown' ? 1 : -1;
                        selectedIndex = (selectedIndex + delta + lastResults.length) % Math.min(lastResults.length, 40);
                        var nodes = $$('.search-result', modalResults);
                        nodes.forEach(function (n, i) { n.classList.toggle('search-result--selected', i === selectedIndex); });
                        var sel = nodes[selectedIndex];
                        if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
                    } else if (e.key === 'Enter') {
                        var nodes = $$('.search-result', modalResults);
                        var sel = nodes[selectedIndex];
                        if (sel && sel.getAttribute('data-url')) window.location.href = sel.getAttribute('data-url');
                        else {
                            var q = modalInput.value.trim();
                            window.location.href = (CFG.searchPageUrl || 'search/') + (q ? '?q=' + encodeURIComponent(q) : '');
                        }
                    }
                });
            }
            if (modalClear) {
                modalClear.addEventListener('click', function () {
                    if (modalInput) { modalInput.value = ''; modalInput.focus(); }
                    updateModal([], '');
                });
            }
        }
        doc.addEventListener('keydown', function (e) {
            if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                if (!overlay || overlay.hidden) openModal();
                else closeModal();
            } else if (e.key === 'Escape' && overlay && !overlay.hidden) {
                closeModal();
            }
        });
        doc.addEventListener('click', function (e) {
            var t = e.target.closest('[data-wakusei-search], [data-action="open-search"]');
            if (t) { e.preventDefault(); openModal(); return; }
            var sb = e.target.closest('#top-bar-sidebar [data-action="open-search"]');
            if (sb) closeSidebar();
        });

        /* ---- 整页搜索 ---- */
        (function searchPage() {
            var input = $('#site-search-input');
            if (!input) return;
            var listBox = $('.search-results');
            var summary = $('#search-summary');
            var empty = $('.search-empty');
            var clearBtn = $('.search-clear');
            var initialHTML = listBox ? listBox.innerHTML : '';
            var initialCount = listBox ? listBox.children.length : 0;
            function renderEmptyQuery() {
                if (listBox) listBox.innerHTML = initialHTML;
                if (summary) summary.hidden = true;
                if (empty) empty.hidden = true;
                if (clearBtn) clearBtn.hidden = true;
            }
            function run(q) {
                if (!q) { renderEmptyQuery(); return; }
                loadIndex().then(function (entries) {
                    var results = searchPosts(entries, q);
                    if (listBox) {
                        listBox.innerHTML = '';
                        results.slice(0, 60).forEach(function (r) { listBox.appendChild(resultNode(r)); });
                    }
                    if (summary) {
                        summary.hidden = false;
                        var spans = $$('span', summary);
                        if (spans[0]) spans[0].textContent = results.length + ' 条结果';
                        if (spans[1]) spans[1].textContent = '关键词:' + q;
                    }
                    if (empty) empty.hidden = !!results.length;
                    if (clearBtn) clearBtn.hidden = false;
                }).catch(function () {
                    if (empty) { empty.hidden = false; $('p', empty).textContent = '索引加载失败'; }
                });
            }
            var t = 0;
            input.addEventListener('input', function () {
                clearTimeout(t);
                var q = input.value.trim();
                t = setTimeout(function () {
                    run(q);
                    var url = window.location.pathname + (q ? '?q=' + encodeURIComponent(q) : '');
                    history.replaceState(null, '', url);
                }, 160);
            });
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') {
                    if (input.value) { input.value = ''; run(''); history.replaceState(null, '', window.location.pathname); }
                }
            });
            if (clearBtn) {
                clearBtn.addEventListener('click', function () {
                    input.value = '';
                    run('');
                    history.replaceState(null, '', window.location.pathname);
                    input.focus();
                });
            }
            if (empty) {
                empty.addEventListener('click', function (e) {
                    if (e.target.closest('.search-empty__button')) {
                        input.value = '';
                        run('');
                    }
                });
            }
            var q0 = new URLSearchParams(window.location.search).get('q');
            if (q0) { input.value = q0; run(q0); }
        })();

        return { openModal: openModal, closeModal: closeModal };
    })();

    /* ---------------- 移动端侧栏 ---------------- */
    var sidebar = $('#top-bar-sidebar');
    var sidebarOverlay = $('.top-bar-sidebar-overlay');
    function openSidebar() {
        if (!sidebar) return;
        var dark = html.getAttribute('data-theme') === 'dark';
        sidebar.classList.toggle('theme-dark', dark);
        sidebar.classList.toggle('theme-light', !dark);
        sidebar.setAttribute('data-open', '');
        if (sidebarOverlay) sidebarOverlay.setAttribute('data-open', '');
    }
    function closeSidebar() {
        if (!sidebar) return;
        sidebar.removeAttribute('data-open');
        if (sidebarOverlay) sidebarOverlay.removeAttribute('data-open');
    }
    doc.addEventListener('click', function (e) {
        if (e.target.closest('#avatarBox') && isMobileMQ.matches) { openSidebar(); return; }
        if (e.target.closest('.top-bar-left') && isMobileMQ.matches) { e.preventDefault(); openSidebar(); return; }
        var overlay = e.target === sidebarOverlay ? sidebarOverlay : null;
        if (overlay) closeSidebar();
    });
    doc.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSidebar();
    });
    if (scroller) scroller.addEventListener('scroll', closeSidebar, { passive: true });

    /* ---------------- avatar 点击(桌面滚动到文章列表) ---------------- */
    doc.addEventListener('click', function (e) {
        var box = e.target.closest('#avatarBox');
        if (!box || isMobileMQ.matches) return;
        var posts = $('#posts');
        if (posts && scroller) {
            var rect = posts.getBoundingClientRect();
            var sRect = scroller.getBoundingClientRect();
            scroller.scrollTo({ top: scroller.scrollTop + rect.top - sRect.top, behavior: 'smooth' });
        }
    });

    bindScroller();
})();
