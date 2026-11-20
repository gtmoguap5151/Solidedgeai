#!/usr/bin/env python3
"""Rebuild the GALINYX draft log (governance-core/staging/draft-log.md).

Run by the 8-hour cron (draft-log-refresh) and by hand after any draft is
staged or decided. Status comes from each draft file's own header only:
an explicit `Status:` line, a `DECISION` line, or a first-line banner.
Anything without an explicit decision is "Staged — pending review".
The log never guesses a decision.

The log carries a timer: last updated + next update (last + 8 hours).
"""
import pathlib
import re
import datetime
from collections import OrderedDict, Counter

STAGING = pathlib.Path('/home/hatch/workspace/galinyx-governance/governance-core/staging')
LOG = STAGING / 'draft-log.md'
INTERVAL_HOURS = 8


def status_of(lines):
    head = '\n'.join(lines[:15])
    first = lines[0].strip() if lines else ''
    m = re.search(r'^Status:\s*(.+)$', head, re.MULTILINE | re.IGNORECASE)
    if m:
        s = m.group(1).strip().lower()
        if s.startswith('approved'):
            return 'Approved — listed on store' if 'listed' in s else 'Approved'
        if s.startswith('published'):
            return 'Published'
        if s.startswith('denied') or s.startswith('refused'):
            return 'Denied'
        if 'staging' in s or 'pending' in s:
            return 'Staged — pending review'
    m = re.search(r'^DECISION[^:]*:\s*(.+)$', head, re.MULTILINE | re.IGNORECASE)
    if m:
        su = m.group(1).strip().upper()
        if su.startswith('APPROVED'):
            return 'Approved (advisory)' if 'ADVISORY' in su else 'Approved'
        if su.startswith('DENIED') or su.startswith('REFUSED'):
            return 'Denied'
        if su.startswith('PUBLISHED'):
            return 'Published'
    fu = first.upper()
    if fu.startswith('APPROVED'):
        return 'Approved — listed on store' if 'LISTED' in fu else 'Approved'
    if fu.startswith('PUBLISHED'):
        return 'Published'
    if fu.startswith('DENIED') or fu.startswith('REFUSED'):
        return 'Denied'
    return 'Staged — pending review'


def main():
    files = sorted(p for p in STAGING.glob('*.md') if p.name != 'draft-log.md')
    rows = []
    for f in files:
        text = f.read_text(errors='replace')
        lines = text.splitlines()
        title = ''
        for ln in lines[:12]:
            m = re.match(r'#+\s+(.*)', ln.strip())
            if m:
                title = m.group(1).strip()
                break
        if not title:
            title = f.stem.replace('-', ' ').title()
        m = re.match(r'draft-(?:new-)?([a-z0-9]+(?:-[a-z0-9]+)?)', f.stem)
        op = m.group(1) if m else 'unassigned'
        mtime = datetime.datetime.fromtimestamp(f.stat().st_mtime, datetime.timezone.utc)
        rows.append({'file': f.name, 'operator': op, 'title': title[:90],
                     'date': mtime.strftime('%Y-%m-%d'), 'status': status_of(lines)})

    groups = OrderedDict()
    for r in rows:
        groups.setdefault(r['operator'], []).append(r)

    now = datetime.datetime.now(datetime.timezone.utc)
    nxt = now + datetime.timedelta(hours=INTERVAL_HOURS)
    fmt = '%Y-%m-%d %H:%M UTC'
    out = []
    out.append('# Draft Log — GALINYX OS')
    out.append('')
    out.append('The governed record of every draft staged by the GALINYX workforce.')
    out.append('One row per draft. A draft is staged when an operator writes it to')
    out.append('`governance-core/staging/`; it leaves "pending review" only when the')
    out.append("owner (or Xena, under the owner's delegated draft-approval authority)")
    out.append('decides it: approved, denied, or published. Nothing in this log is a')
    out.append('live action — staging is draft-only by design.')
    out.append('')
    out.append('This log is part of the GALINYX licensing package: it is the proof that')
    out.append('the Governance Core stages, reviews, and decides operator work under')
    out.append("the owner's authority, with a record for every draft. The package")
    out.append('itself is ON HOLD until the system proves itself (owner\'s order,')
    out.append('Nov 19, 2026) — this log is the evidence being gathered in the meantime.')
    out.append('')
    out.append(f'**Drafts on file:** {len(rows)} · **Last updated:** {now.strftime(fmt)} · '
               f'**Next update:** {nxt.strftime(fmt)} · **Updates every 8 hours** · **Core:** v1.5.0')
    out.append('')
    out.append("Status comes from each draft file's own header: an explicit `Status:`")
    out.append('line, a `DECISION` line, or a first-line banner. Anything without an')
    out.append('explicit decision is `Staged — pending review` — the log never guesses')
    out.append('a decision. Maintenance: append a row when a draft is staged; update')
    out.append("the row (and the draft file's header) when it is decided.")
    out.append('')
    for op, items in sorted(groups.items()):
        out.append(f'## {op} ({len(items)})')
        out.append('')
        out.append('| Draft | Staged | Status | Title |')
        out.append('|---|---|---|---|')
        for r in sorted(items, key=lambda x: (x['date'], x['file'])):
            title = r['title'].replace('|', '/')
            out.append(f"| `{r['file']}` | {r['date']} | {r['status']} | {title} |")
        out.append('')

    LOG.write_text('\n'.join(out))
    print(f'draft log rebuilt: {len(rows)} drafts, {len(groups)} operator groups')
    print(Counter(r['status'] for r in rows))
    print(f'last updated {now.strftime(fmt)}; next update {nxt.strftime(fmt)}')


if __name__ == '__main__':
    main()
