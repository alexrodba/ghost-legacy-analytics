(function () {
    'use strict';

    /*
     * Admin overlay: paints imported legacy email stats onto the Ghost admin
     * posts list (/ghost/#/posts), where migrated posts otherwise show no
     * analytics because the data never made it into the new database.
     *
     * Read-only, client-side, changes no data. It reproduces Ghost's own
     * posts-list markup + classes so the columns align and the native
     * "Newsletter performance" / "New members" tooltips work for free.
     *
     * Hosting: by default this file is served from your theme at
     * /assets/js/legacy-admin-analytics.js and the data from
     * /assets/data/legacy-analytics.json. Change the two constants below if you
     * host them elsewhere (must be same-origin as the admin).
     */

    var JSON_URL = '/assets/data/legacy-analytics.json';
    var POSTS_API = '/ghost/api/admin/posts/?limit=all&fields=id,slug&formats=';

    // Exact lucide paths Ghost uses for these metrics.
    var PATH_SENT = '<path d="M14.536 21.686a.5.5 0 00.937-.024l6.5-19a.496.496 0 00-.635-.635l-19 6.5a.5.5 0 00-.024.937l7.93 3.18a2 2 0 011.112 1.11z"></path><path d="M21.854 2.147l-10.94 10.939"></path>';
    var PATH_OPENS = '<path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 01-2 2H4a2 2 0 01-2-2V10a2 2 0 01.8-1.6l8-6a2 2 0 012.4 0l8 6z"></path><path d="M22 10l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 10"></path>';
    var PATH_CLICKS = '<path d="M14 4.1L12 6M5.1 8l-2.9-.8M6 12l-1.9 2M7.2 2.2L8 5.1M9.037 9.69a.498.498 0 01.653-.653l11 4.5a.5.5 0 01-.074.949l-4.349 1.041a1 1 0 00-.74.739l-1.04 4.35a.5.5 0 01-.95.074z"></path>';

    function num(n) { return Number(n || 0).toLocaleString('en-US'); }
    function rate(part, whole) { return whole ? Math.round((part / whole) * 100) : 0; }

    function svg(paths, cls) {
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
               'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"' +
               (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true">' + paths + '</svg>';
    }

    function ttRow(paths, label, value) {
        return '<div class="metric"><div class="data">' + svg(paths, '') + label + '</div>' +
               '<span>' + num(value) + '</span></div>';
    }

    function metricItem(paths, pct) {
        return '<span class="gh-list-data gh-post-list-metrics">' +
                   '<div class="gh-post-list-analytics-metric legacy-admin-metric-item">' +
                       svg(paths, 'gh-list-analytics-icon') +
                       '<span class="gh-content-email-stats-value">' + pct + '%</span>' +
                   '</div>' +
               '</span>';
    }

    // A full copy of Ghost's email-metrics group: the "Newsletter performance"
    // tooltip + the open%/click% columns, all using Ghost's own classes.
    function buildEmailMetrics(entry) {
        var sends = entry.sends || 0, opens = entry.opens || 0, clicks = entry.clicks || 0;
        var div = document.createElement('div');
        div.className = 'gh-post-analytics-email-metrics gh-post-list-analytics-tt-container legacy-admin-email-metrics';
        div.innerHTML =
            '<div class="gh-post-list-analytics-tooltip above">' +
                '<h3>Newsletter performance</h3>' +
                '<div class="metrics">' +
                    ttRow(PATH_SENT, 'Sent', sends) +
                    ttRow(PATH_OPENS, 'Opens', opens) +
                    ttRow(PATH_CLICKS, 'Clicks', clicks) +
                '</div>' +
            '</div>' +
            metricItem(PATH_OPENS, rate(opens, sends)) +
            metricItem(PATH_CLICKS, rate(clicks, sends));
        return div;
    }

    function injectStyles() {
        if (document.getElementById('legacy-admin-analytics-styles')) return;
        // Legacy stats a touch lighter than native (icon #7b8189 / value #a9b0b7)
        // so they read as imported, while keeping the value lighter than its icon.
        var css =
            '.gh-post-list-analytics-metric.legacy-admin-metric-item{color:#99a1a8;}' +
            '.legacy-admin-metric-item .gh-content-email-stats-value{color:#b7bdc2;}';
        var style = document.createElement('style');
        style.id = 'legacy-admin-analytics-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // Only write when the value changes, so we never emit a no-op DOM mutation
    // that would re-trigger our own observer in a loop.
    function setText(el, value) {
        if (el && el.textContent.trim() !== String(value)) el.textContent = value;
    }

    // Ghost already renders the members "+N" and its "New members" Free/Paid
    // tooltip (0 for migrated posts). Update those numbers in place.
    function updateNativeMembers(container, entry) {
        var total = entry.signups || 0, paid = entry.paid || 0, free = Math.max(0, total - paid);
        setText(container.querySelector('[data-test-analytics-member-conversions] .gh-content-email-stats-value'), num(total));
        var metrics = container.querySelectorAll('.gh-post-list-analytics-tooltip .metric');
        for (var i = 0; i < metrics.length; i++) {
            var data = metrics[i].querySelector('.data');
            var span = metrics[i].querySelector('span');
            if (!data || !span) continue;
            if (/Free/i.test(data.textContent)) setText(span, num(free));
            else if (/Paid/i.test(data.textContent)) setText(span, num(paid));
        }
    }

    // A post emailed in the *new* instance has real native open/click metrics —
    // leave those completely alone.
    function emailedNatively(container) {
        return !!container.querySelector('[data-test-analytics-opens],[data-test-analytics-clicks]');
    }

    var byId = null; // post id -> { sends, opens, clicks, signups, paid }

    function decorate() {
        if (!byId) return;
        var rows = document.querySelectorAll('.gh-posts-list-item[data-test-post-id]');
        for (var i = 0; i < rows.length; i++) {
            var li = rows[i];
            var entry = byId[li.getAttribute('data-test-post-id')];
            if (!entry || !entry.opens) continue;

            var container = li.querySelector('.gh-post-list-metrics-container');
            if (!container) continue;
            if (emailedNatively(container)) continue;

            if (!container.querySelector('.legacy-admin-email-metrics')) {
                var members = container.querySelector('a.gh-post-list-metrics');
                var el = buildEmailMetrics(entry);
                if (members) container.insertBefore(el, members);
                else container.appendChild(el);
            }

            updateNativeMembers(container, entry);
        }
    }

    var scheduled = false;
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(function () { scheduled = false; decorate(); });
    }

    function start() {
        Promise.all([
            fetch(JSON_URL, { credentials: 'same-origin' }).then(function (r) {
                if (!r.ok) throw new Error('json ' + r.status); return r.json();
            }),
            fetch(POSTS_API, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) {
                if (!r.ok) throw new Error('api ' + r.status); return r.json();
            })
        ]).then(function (res) {
            var legacy = res[0];
            var posts = (res[1] && res[1].posts) || [];
            byId = {};
            posts.forEach(function (p) {
                if (p && p.slug && legacy[p.slug]) byId[p.id] = legacy[p.slug];
            });
            injectStyles();
            decorate();
            new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
        }).catch(function (e) {
            console.debug('legacy-admin-analytics: skipped', e);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
}());
