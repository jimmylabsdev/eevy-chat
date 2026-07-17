/**
 * guideBuilder.js — builds the HTML that gets emailed via /api/v3/notify's
 * guide_html field.
 *
 * index.html's emailKit() scrapes the already-rendered #screen-kit DOM node
 * and inlines its CSS custom properties. That works there because the kit
 * is plain server-rendered markup sharing the page's global stylesheet.
 * The chat app's BuyingKitScreen is a React component — no equivalent DOM
 * scrape available, and even if there were, its styling depends on
 * component-scoped CSS that wouldn't survive being lifted into an email.
 *
 * So instead: a pure function of the same data buildBuyingKitData() already
 * produces. Every element is inline-styled (no <style> block, no CSS vars)
 * since email clients strip both. Same color palette and section order as
 * index.html's kit for visual consistency.
 */

const COLORS = {
  orange: '#F06A22',
  orangeLight: '#FEF3EC',
  orangeDark: '#C45516',
  green: '#1A7A4A',
  greenLight: '#E8F5EE',
  teal: '#0D9488',
  ink: '#1A1A1A',
  ink2: '#3D3D3D',
  ink3: '#6B6B6B',
  ink4: '#9A9A9A',
  ink5: '#C4C4C4',
  rule: '#EBEBEB',
  ruleSoft: '#F3F3F1',
  surface: '#FFFFFF',
  bg: '#F6F5F3',
  bgWarm: '#FAF9F7',
};

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function section(title, innerHtml) {
  return `
    <tr><td style="padding:28px 32px 0 32px">
      <p style="font-size:0.75rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${COLORS.ink4};margin:0 0 12px 0">${esc(title)}</p>
      ${innerHtml}
    </td></tr>`;
}

function vehicleCard(v) {
  return `
    <div style="border:1px solid ${COLORS.rule};border-radius:12px;padding:16px;margin-bottom:10px;background:${COLORS.surface}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <p style="margin:0 0 4px 0;font-weight:700;color:${COLORS.ink};font-size:0.9375rem">${esc(v.title)}${v.selected ? ' <span style="color:'+COLORS.green+';font-size:0.75rem;font-weight:700">(your pick)</span>' : ''}</p>
          <p style="margin:0;color:${COLORS.ink3};font-size:0.8125rem">${esc(v.rangeLabel)}</p>
        </div>
        <p style="margin:0;font-weight:700;color:${COLORS.orange};font-size:0.9375rem;white-space:nowrap">${esc(v.priceLabel)}</p>
      </div>
      ${v.topPick ? `<p style="margin:8px 0 0 0;display:inline-block;background:${COLORS.orangeLight};color:${COLORS.orangeDark};font-size:0.6875rem;font-weight:700;padding:3px 8px;border-radius:6px">TOP PICK</p>` : ''}
    </div>`;
}

function checklistGroup(group) {
  const items = group.items.map((item) => `<li style="margin-bottom:6px;color:${COLORS.ink2};font-size:0.875rem;line-height:1.5">${esc(item)}</li>`).join('');
  return `
    <p style="margin:16px 0 8px 0;font-weight:700;color:${COLORS.ink};font-size:0.875rem">${esc(group.title)}</p>
    <ul style="margin:0;padding-left:20px">${items}</ul>`;
}

/**
 * @param {object} data   — the exact object buildBuyingKitData() returns
 *                          (vehicles, cost, insurance, running, charging,
 *                          checklist, readiness)
 * @param {object} meta   — { name } for the greeting line
 * @returns {string} full standalone HTML document, inline-styled throughout
 */
export function buildGuideHtml(data, meta = {}) {
  const name = meta.name ? meta.name.split(' ')[0] : null;
  const { vehicles = [], cost = {}, insurance = {}, running = {}, charging = {}, checklist = {}, readiness = {} } = data || {};

  const vehiclesHtml = vehicles.length
    ? vehicles.map(vehicleCard).join('')
    : `<p style="color:${COLORS.ink3};font-size:0.875rem;margin:0">No shortlist on file yet.</p>`;

  const costHtml = `
    <div style="border:1px solid ${COLORS.rule};border-radius:12px;padding:16px;background:${COLORS.surface}">
      <p style="margin:0 0 8px 0;font-size:0.875rem;color:${COLORS.ink2}">On-road price: <strong style="color:${COLORS.ink}">₹${cost.onRoad ?? '—'}L</strong></p>
      ${cost.isCash
        ? `<p style="margin:0;font-size:0.875rem;color:${COLORS.ink2}">Payment mode: <strong style="color:${COLORS.ink}">Full cash</strong></p>`
        : `<p style="margin:0 0 4px 0;font-size:0.875rem;color:${COLORS.ink2}">Down payment: <strong style="color:${COLORS.ink}">₹${cost.downPayment ?? 0}L</strong></p>
           <p style="margin:0;font-size:0.875rem;color:${COLORS.ink2}">Estimated EMI: <strong style="color:${COLORS.orange}">₹${cost.emi ?? '—'}/mo</strong></p>`}
      ${cost.selectedLoanPartner ? `<p style="margin:8px 0 0 0;font-size:0.8125rem;color:${COLORS.ink3}">Lender: ${esc(cost.selectedLoanPartner)}</p>` : ''}
    </div>`;

  const insuranceHtml = `
    <div style="border:1px solid ${COLORS.rule};border-radius:12px;padding:16px;background:${COLORS.surface}">
      <p style="margin:0 0 8px 0;font-size:0.875rem;color:${COLORS.ink2}">Coverage: <strong style="color:${COLORS.ink}">${esc(insurance.coverageLabel || '—')}</strong></p>
      <p style="margin:0;font-size:0.875rem;color:${COLORS.ink2}">Estimated premium: <strong style="color:${COLORS.orange}">₹${insurance.totalK ?? '—'}K/yr</strong></p>
      ${insurance.selectedInsurancePartner ? `<p style="margin:8px 0 0 0;font-size:0.8125rem;color:${COLORS.ink3}">Insurer: ${esc(insurance.selectedInsurancePartner)}</p>` : ''}
    </div>`;

  const runningHtml = `
    <div style="border:1px solid ${COLORS.rule};border-radius:12px;padding:16px;background:${COLORS.surface}">
      <p style="margin:0 0 6px 0;font-size:0.875rem;color:${COLORS.ink2}">Petrol/diesel equivalent: <strong style="color:${COLORS.ink}">₹${running.monthlyFuel ?? '—'}/mo</strong></p>
      <p style="margin:0 0 6px 0;font-size:0.875rem;color:${COLORS.ink2}">EV charging cost: <strong style="color:${COLORS.ink}">₹${running.monthlyCharge ?? '—'}/mo</strong></p>
      <p style="margin:0;font-size:0.875rem;color:${COLORS.green};font-weight:700">You save ~₹${running.monthlySave ?? '—'}/mo</p>
    </div>`;

  const chargingHtml = `
    <div style="border:1px solid ${COLORS.rule};border-radius:12px;padding:16px;background:${charging.ok ? COLORS.greenLight : COLORS.orangeLight}">
      <p style="margin:0 0 6px 0;font-size:0.875rem;font-weight:700;color:${COLORS.ink}">${esc(charging.label || '—')}</p>
      <p style="margin:0 0 4px 0;font-size:0.8125rem;color:${COLORS.ink2}">Recommended: ${esc(charging.charger || '—')}</p>
      <p style="margin:0;font-size:0.8125rem;color:${COLORS.ink3}">Estimated install: ${esc(charging.install || '—')}</p>
    </div>`;

  const checklistHtml = (checklist.groups || []).map(checklistGroup).join('');

  const nextStepsHtml = (readiness.nextSteps || [])
    .map((s) => `<li style="margin-bottom:8px;color:${COLORS.ink2};font-size:0.875rem;line-height:1.5">${esc(s)}</li>`)
    .join('');

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:${COLORS.surface};border-radius:16px;overflow:hidden;max-width:600px">

        <tr><td style="padding:32px 32px 0 32px">
          <p style="font-size:0.75rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${COLORS.ink4};margin:0 0 4px 0">My EV Buying Kit</p>
          <h1 style="font-size:1.5rem;font-weight:800;color:${COLORS.ink};margin:0 0 16px 0">
            ${name ? `${esc(name)}'s complete buying guide` : 'Your complete buying guide'}
          </h1>
          <div style="background:${COLORS.ruleSoft};border-radius:10px;padding:12px 16px">
            <p style="margin:0;font-size:0.8125rem;color:${COLORS.ink3}">Buying readiness</p>
            <p style="margin:2px 0 0 0;font-size:1.25rem;font-weight:800;color:${COLORS.orange}">${readiness.score ?? '—'}% · ${esc(readiness.label || '')}</p>
          </div>
        </td></tr>

        ${section('Recommended EVs', vehiclesHtml)}
        ${section('Cost Summary', costHtml)}
        ${section('Insurance Estimate', insuranceHtml)}
        ${section('Running Costs', runningHtml)}
        ${section('Charging Readiness', chargingHtml)}
        ${section('Dealer Checklist', checklistHtml)}
        ${section('Next Steps', `<ul style="margin:0;padding-left:20px">${nextStepsHtml}</ul>`)}

        <tr><td style="padding:28px 32px 32px 32px">
          <p style="text-align:center;font-size:0.8125rem;color:${COLORS.ink};margin:0 0 8px 0">
            Made with care by <a href="https://eevy.in" style="color:${COLORS.ink};font-weight:700;text-decoration:none">eevy<span style="color:${COLORS.teal}">.</span>india</a>
          </p>
          <p style="text-align:center;font-size:0.6875rem;color:${COLORS.ink5};margin:0 0 4px 0">
            © 2026 eevy.india · All rights reserved · For informational purposes only · All estimates are indicative. Actual costs depend on model, city, insurer, and market conditions at the time of purchase.
          </p>
          <p style="text-align:center;font-size:0.6875rem;color:${COLORS.ink4};margin:0">
            Questions or feedback? Write to us at <a href="mailto:hello@eevy.in" style="color:${COLORS.ink4};text-decoration:underline">hello@eevy.in</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
