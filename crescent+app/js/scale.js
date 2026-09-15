/* ========================================
   Crescent+ — "Same UI on mobile as desktop"
   ========================================
   Desktop shows a fixed ~480px white app card
   centered on an off-white page. On phones this
   script shrinks that exact same card (same fonts,
   same spacing, same layout — nothing redesigned)
   to fit the real screen width, and stretches it to
   fill the whole screen edge-to-edge so the
   off-white background is never visible on mobile —
   only the white app screen shows.

   How it works:
   - Below DESIGN_WIDTH (the fixed desktop card
     width), we add the "is-compact" class to <html>
     (style.css uses this to remove the card's
     rounded corners/shadow/margins on mobile) and
     shrink the whole card using CSS `zoom`, which
     (unlike `transform: scale`) also shrinks the
     space the card reserves in the page, so there's
     no leftover blank gap.
   - Older browsers without `zoom` support fall back
     to `transform: scale`.
   - At or above DESIGN_WIDTH (tablets/desktops),
     everything is reset back to the normal centered
     card view with the off-white background visible.
   ======================================== */
(function () {
    var DESIGN_WIDTH = 480; // the fixed desktop app-card width used throughout style.css
    var MOBILE_BREAKPOINT = 520; // small buffer so tablets keep the normal desktop card view

    var SELECTOR = [
        '.app-container',
        '.intro-container',
        '.login-container',
        '.register-container',
        '.dashboard-container',
        '.profile-container',
        '.crescent-container',
        '.request-container'
    ].join(', ');

    var supportsZoom = (function () {
        try {
            return !!(window.CSS && CSS.supports && CSS.supports('zoom', '1'));
        } catch (e) {
            return false;
        }
    })();

    function getContainer() {
        return document.querySelector(SELECTOR);
    }

    function reset(el) {
        document.documentElement.classList.remove('is-compact');
        el.style.zoom = '';
        el.style.transform = '';
        el.style.transformOrigin = '';
        el.style.width = '';
        el.style.minHeight = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.body.style.overflow = '';
    }

    function applyScale() {
        var el = getContainer();
        if (!el) return;

        var vw = window.innerWidth;
        var vh = window.innerHeight;

        if (vw >= MOBILE_BREAKPOINT) {
            reset(el);
            return;
        }

        document.documentElement.classList.add('is-compact');

        var scale = vw / DESIGN_WIDTH;
        // Height the card needs *before* scaling so that after scaling
        // it exactly fills the real screen height (no gap, no crop).
        var localHeight = vh / scale;

        el.style.width = DESIGN_WIDTH + 'px';
        el.style.minHeight = localHeight + 'px';

        if (supportsZoom) {
            el.style.zoom = scale;
            el.style.transform = '';
        } else {
            // Fallback for the rare browser without CSS zoom support.
            el.style.transformOrigin = 'top left';
            el.style.transform = 'scale(' + scale + ')';
            document.body.style.width = vw + 'px';
            document.body.style.height = vh + 'px';
            document.body.style.overflow = 'hidden';
        }
    }

    var resizeTimer = null;
    function scheduleScale() {
        if (resizeTimer) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(applyScale, 60);
    }

    document.addEventListener('DOMContentLoaded', applyScale);
    window.addEventListener('resize', scheduleScale);
    window.addEventListener('orientationchange', scheduleScale);
    // Run immediately too, in case DOMContentLoaded already fired
    // (script tags are placed at the end of <body> in this project).
    applyScale();
})();