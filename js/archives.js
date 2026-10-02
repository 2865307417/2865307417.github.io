/* ============================================================
 * Wakusei HomePage · archives.js
 * 归档页:话题折叠 / 年份跳转 / 文章入场动画 / 分类·标签筛选
 * 对齐原 ArchivesPage.vue
 * ============================================================ */
(function () {
    'use strict';
    var doc = document;
    var $ = function (s, r) { return (r || doc).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
    var scroller = $('#pageScroller') || $('.page-scroller');
    var root = $('.archives-page');
    if (!root) return;

    var COLLAPSED_CATEGORY = 6;
    var COLLAPSED_TAG = 10;
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------- 话题折叠 ---------------- */
    (function collapseTopics() {
        var catGrid = $('.archives-category-grid', root);
        var tagIndex = $('.archives-tag-index', root);
        var expandBtn = $('.archives-topics-expand', root);
        var collapsed = true;
        function apply() {
            if (catGrid) {
                $$('.archives-category-card', catGrid).forEach(function (c, i) {
                    c.style.display = !collapsed || i < COLLAPSED_CATEGORY ? '' : 'none';
                });
            }
            if (tagIndex) {
                $$('.archives-tag-term', tagIndex).forEach(function (t, i) {
                    t.style.display = !collapsed || i < COLLAPSED_TAG ? '' : 'none';
                });
            }
            if (expandBtn) {
                expandBtn.textContent = collapsed ? '展开全部' : '收起';
                expandBtn.setAttribute('aria-expanded', String(!collapsed));
            }
        }
        if (expandBtn && (($$('.archives-category-card', root).length > COLLAPSED_CATEGORY) || ($$('.archives-tag-term', root).length > COLLAPSED_TAG))) {
            expandBtn.addEventListener('click', function () {
                collapsed = !collapsed;
                apply();
            });
            apply();
        } else if (expandBtn) {
            expandBtn.style.display = 'none';
        }
    })();

    /* ---------------- 年份索引跳转 + 高亮 ---------------- */
    (function yearIndex() {
        var nav = $('.archives-year-index', root);
        if (!nav || !scroller) return;
        var btns = $$('.archives-year-index__btn', nav);
        nav.addEventListener('click', function (e) {
            var btn = e.target.closest('.archives-year-index__btn');
            if (!btn) return;
            var target = $('#year-' + btn.getAttribute('data-year'));
            if (!target) return;
            var rect = target.getBoundingClientRect();
            var sRect = scroller.getBoundingClientRect();
            scroller.scrollTo({ top: scroller.scrollTop + rect.top - sRect.top - 112, behavior: 'smooth' });
        });
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                var y = en.target.getAttribute('data-year');
                btns.forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-year') === y); });
            });
        }, { root: scroller, rootMargin: '-18% 0px -62% 0px', threshold: 0 });
        $$('.archives-year', root).forEach(function (y) { io.observe(y); });
    })();

    /* ---------------- 文章入场动画 ---------------- */
    (function entrance() {
        var posts = $$('.archives-post', root);
        if (!posts.length || !('IntersectionObserver' in window)) return;
        posts.forEach(function (p, i) {
            p.classList.add('archives-post--animated');
            p.setAttribute('data-anim-delay', String(Math.min(i * 60, 300)));
        });
        if (reducedMotion) {
            posts.forEach(function (p) { p.classList.add('is-visible'); });
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                var el = en.target;
                el.style.transitionDelay = (el.getAttribute('data-anim-delay') || 0) + 'ms';
                el.classList.add('is-visible');
                io.unobserve(el);
            });
        }, { root: scroller, rootMargin: '0px 0px -40px 0px', threshold: 0.05 });
        posts.forEach(function (p) { io.observe(p); });
    })();

    /* ---------------- 分类/标签筛选 ---------------- */
    (function filter() {
        var timeline = $('.archives-timeline', root);
        if (!timeline) return;
        var posts = $$('.archives-post', root);
        var summary = $('.archives-result-summary', root);
        var yearSections = $$('.archives-year', root);
        var monthSections = $$('.archives-month', root);
        var params = new URLSearchParams(window.location.search);
        var state = { category: params.get('category') || '', tag: params.get('tag') || '' };

        function apply() {
            var any = !!(state.category || state.tag);
            var visibleCount = 0;
            posts.forEach(function (p) {
                var cat = p.getAttribute('data-category') || '';
                var tags = (p.getAttribute('data-tags') || '').split(',').filter(Boolean);
                var show = true;
                if (state.category && cat !== state.category) show = false;
                if (state.tag && tags.indexOf(state.tag) < 0) show = false;
                p.style.display = show ? '' : 'none';
                if (show) visibleCount += 1;
            });
            monthSections.forEach(function (m) {
                var visible = $$('.archives-post', m).filter(function (p) { return p.style.display !== 'none'; });
                m.style.display = visible.length ? '' : 'none';
            });
            yearSections.forEach(function (y) {
                var visible = $$('.archives-month', y).filter(function (m) { return m.style.display !== 'none'; });
                y.style.display = visible.length ? '' : 'none';
            });
            $$('.archives-category-card', root).forEach(function (c) {
                c.classList.toggle('is-active', c.getAttribute('data-category') === state.category);
            });
            $$('.archives-tag-term', root).forEach(function (t) {
                t.classList.toggle('is-active', t.getAttribute('data-tag') === state.tag);
            });
            if (summary) {
                if (any) {
                    var parts = [];
                    if (state.category) parts.push('分类「' + state.category + '」');
                    if (state.tag) parts.push('标签「' + state.tag + '」');
                    summary.innerHTML = '';
                    var span = doc.createElement('span');
                    span.textContent = parts.join(' + ') + ':共 ' + visibleCount + ' 篇';
                    var clear = doc.createElement('button');
                    clear.type = 'button';
                    clear.className = 'archives-filter-reset';
                    clear.textContent = '清除筛选';
                    clear.addEventListener('click', function () {
                        state = { category: '', tag: '' };
                        syncUrl();
                        apply();
                    });
                    summary.appendChild(span);
                    summary.appendChild(clear);
                } else {
                    summary.textContent = '共 ' + posts.length + ' 篇文章';
                }
            }
        }
        function syncUrl() {
            var q = new URLSearchParams();
            if (state.category) q.set('category', state.category);
            if (state.tag) q.set('tag', state.tag);
            var qs = q.toString();
            history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
        }
        root.addEventListener('click', function (e) {
            var cat = e.target.closest('.archives-category-card');
            if (cat) {
                var c = cat.getAttribute('data-category');
                state.category = state.category === c ? '' : c;
                syncUrl();
                apply();
                return;
            }
            var tag = e.target.closest('.archives-tag-term');
            if (tag) {
                var t = tag.getAttribute('data-tag');
                state.tag = state.tag === t ? '' : t;
                syncUrl();
                apply();
            }
        });
        if (state.category || state.tag) apply();
    })();
})();
