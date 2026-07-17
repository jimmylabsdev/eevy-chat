/**
 * Shares a text summary via the OS share sheet (WhatsApp, Mail, SMS,
 * whatever the person has installed) using the Web Share API — this is
 * the mechanism that lets a single "Share" button hand off to any app,
 * rather than building a bespoke integration per channel.
 *
 * Deliberately text, not an image: a true "screenshot" would need a new
 * client-side rendering dependency (e.g. html2canvas) to rasterize the
 * DOM, which is a heavier, less reliable lift (fonts/gradients/scroll
 * clipping all need care, and it can't be verified without a browser).
 * A well-formatted text summary shares just as cleanly into WhatsApp/Mail
 * and works everywhere immediately. Worth revisiting as a v2 if the
 * visual polish specifically matters enough to take on that dependency.
 *
 * Falls back to copying the text to the clipboard on browsers without
 * navigator.share (most desktops) — still lets the person paste it
 * wherever they want.
 */
export async function shareResult({ title, text }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'; // person closed the share sheet themselves
      // fall through to the clipboard fallback for any other failure
    }
  }
  try {
    await navigator.clipboard.writeText(`${title}\n\n${text}`);
    return 'copied';
  } catch (e) {
    return 'failed';
  }
}
