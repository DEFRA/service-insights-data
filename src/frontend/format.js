// Text/markup formatting shared by the reader and the markup-sweep script.
import { fixMojibake } from './text.js';

export const esc = (v) =>
  v == null ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline markup within a line: links, and stripped emphasis markers. */
export function richInline(t) {
  let s = esc(fixMojibake(t));
  s = s.replace(/\{\{([^}]*)\}\}/g, '$1');                      // {{monospace}} -> text
  s = s.replace(/\{[a-zA-Z]+(?::[^}]*)?\}/g, '');               // {quote}/{code}/{color:red} macros -> drop marker
  s = s.replace(/\[([^\]|]*)\|([^\]]+)\]/g, (_m, text, url) => {
    url = url.trim();
    const label = (text || url).replace(/^\+/, '').trim();
    return /^https?:\/\//i.test(url)
      ? `<a class="govuk-link" href="${url}" rel="noopener noreferrer">${label || url}</a>`
      : label;
  });
  s = s.replace(/\[(https?:\/\/[^\]\s]+)\]/g, (_m, url) => `<a class="govuk-link" href="${url}" rel="noopener noreferrer">${url}</a>`);
  s = s.replace(/\*([^*\n]+)\*/g, '$1');                        // inline *bold*
  s = s.replace(/(^|\s)[+_]([^+_\n]+)[+_](?=\s|$)/g, '$1$2');   // +underline+ / _italic_
  return s;
}

/**
 * Turn Jira wiki markup into safe, structured HTML, block by block. Headings
 * are promoted from the two signals the source uses: an `hN.` prefix, and a
 * whole-line *bold* (excluding Gherkin emphasis like *_As a…_*, which contains
 * underscores). Bullets (including nested levels, flattened), blank-line
 * paragraphs, `----` rules and image embeds are handled. All content headings
 * render at one level (h3) to avoid skipped heading levels. Returns '' for empty
 * input. The data is already mojibake-repaired by the ETL; fixMojibake here is a
 * harmless safety net.
 */
export function richText(raw) {
  if (!raw) return '';
  const lines = fixMojibake(String(raw)).split(/\r\n|\r|\n/);
  const out = [];
  let para = [];
  let bullets = [];
  const flushPara = () => { if (para.length) { out.push(`<p class="govuk-body">${para.join('<br>')}</p>`); para = []; } };
  const flushBullets = () => { if (bullets.length) { out.push(`<ul class="govuk-list govuk-list--bullet">${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`); bullets = []; } };
  const flush = () => { flushPara(); flushBullets(); };

  for (const line of lines) {
    // Drop Jira image embeds (!file.png|params!) — the attachments aren't available.
    let t = line.trim().replace(/!([^!\n]+\.(?:png|jpe?g|gif|bmp|svg)[^!\n]*)!/gi, '').trim();
    if (!t) { flush(); continue; }

    if (/^-{4,}$/.test(t)) { flush(); out.push('<hr class="govuk-section-break govuk-section-break--visible govuk-section-break--m">'); continue; }
    if (/^h[1-6]\.\s*$/.test(t)) { flush(); continue; }   // dangling empty heading marker
    t = t.replace(/^bq\.\s+/, '');                          // Jira blockquote line -> plain

    const heading = t.match(/^h[1-6]\.\s*(.+)$/);
    const wholeBold = /^\*[^*_]+\*$/.test(t); // whole line bold, no underscore
    if (heading || wholeBold) {
      flush();
      const text = richInline((heading ? heading[1] : t).replace(/^\*|\*$/g, '').trim());
      out.push(`<h3 class="govuk-heading-s govuk-!-margin-bottom-1">${text}</h3>`);
      continue;
    }
    // Bullets, including Jira nested levels (**, ***) — flattened to one level.
    if (/^[*#•]{1,}\s+/.test(t)) { flushPara(); bullets.push(richInline(t.replace(/^[*#•]+\s+/, ''))); continue; }

    flushBullets();
    para.push(richInline(t));
  }
  flush();
  return out.join('');
}

export const nameOf = (s) => s.userFacingName || s.internalName || '(unnamed service)';
export const statusTagClass = (name) =>
  ({ Published: 'govuk-tag--green', Draft: 'govuk-tag--grey', Archived: 'govuk-tag--red' }[name] || 'govuk-tag--grey');
