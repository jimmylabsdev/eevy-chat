/* ================================================================
   ANALYTICS (GA4) — chat tool
   Same GA4 property as the main assessment (index.html's eevyTrack /
   G-56HRKMV1ME), so both funnels land in one dashboard. Every event this
   app fires is auto-prefixed 'chat_' here (not left to each call site) so
   it's always distinguishable from the assessment's own events, and so
   nobody can forget the prefix at a new call site.

   Safe wrapper, same pattern as eevyTrack: calls gtag directly once it's
   loaded; queues into dataLayer (which gtag.js drains once ready) if the
   tag is still loading.
================================================================ */

export function track(eventName, params = {}) {
  const name = `chat_${eventName}`;
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params);
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(['event', name, params]);
}
