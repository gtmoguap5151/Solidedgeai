# The File Keeper — Civil Law Case-File Organization Scheme

Written by: The File Keeper
Status: PENDING
Date: 2026-11-20

## In plain English

This document describes how the firm's case files are organized: one folder per matter, the same subfolders inside every one, and the same naming rule on every document. Anyone on the team can find any document in under a minute. Nothing confidential ever leaves the firm's environment.

---

## Folder structure

One folder per matter. Every matter folder holds the same six subfolders, in the same order:

```
[matter number] - [client last name]/
├── 01 - Intake/
├── 02 - Correspondence/
├── 03 - Documents/
├── 04 - Filings/
├── 05 - Billing/
└── 06 - Notes/
```

What goes in each subfolder:

| Subfolder | Contents |
|---|---|
| 01 - Intake | The intake form, the signed engagement letter, identification documents the client provided, and the first notes from the first meeting. |
| 02 - Correspondence | Letters, emails, and messages to and from the client, the other side, and third parties — sent and received, filed in date order. |
| 03 - Documents | Evidence and supporting material: contracts, photos, records, reports, and anything the client or a third party provided. |
| 04 - Filings | Court filings and documents filed with any agency — filed copies only, with the filing stamp or confirmation where the firm has one. The File Keeper stores filings; it never files anything. |
| 05 - Billing | Time-entry drafts, invoice drafts, approved invoices, payment records, and payment reminders. |
| 06 - Notes | The attorney's working notes, internal memos, meeting notes, and the matter index (see below). |

Rules for folders:

- A new matter folder is created only when the attorney opens the matter.
- A document goes in exactly one subfolder. If it could fit two, the attorney decides where it lives.
- No loose documents sit at the top level of a matter folder. Everything goes in a subfolder.
- No document is deleted without the attorney's say-so. If a document is superseded, the old version stays, marked `[superseded by — date]`.

## Naming convention

Every document is named the same way:

```
[matter number]_[client last name]_[document type]_[date].pdf
```

For example:

- `2026-014_Smith_Intake-Form_2026-11-20.pdf`
- `2026-014_Smith_Letter-to-Client_2026-11-21.pdf`
- `2026-014_Smith_Contract_2026-10-02.pdf`

Rules for names:

- **Matter number** — the firm's own number for the matter, as assigned when the matter opens.
- **Client last name** — the client's last name, spelled exactly as it appears in the firm's records.
- **Document type** — a short, plain description of what the document is (Intake-Form, Letter-to-Client, Contract, Invoice-Draft, Court-Notice, Meeting-Notes).
- **Date** — the date of the document itself, in year-month-day order (2026-11-20), so files sort in date order automatically.
- Use hyphens inside a part, underscores between parts. No spaces in file names.
- If a document is revised, the new version keeps the same name with a version marker: `2026-014_Smith_Letter-to-Client_2026-11-21_v2.pdf`. The old version is kept, not overwritten.

## Finding a document in under a minute

Two tools, used together:

1. **The naming convention.** Because every file is named `[matter number]_[client last name]_[document type]_[date]`, a search by matter number or by client last name brings up every document for that matter, in date order. A search by document type narrows it further.

2. **The matter index.** Every matter folder holds a simple index list in `06 - Notes/`, named `[matter number]_[client last name]_Index.md`. One line per document:

```
# Index — [matter number], [client last name]

| Date | Subfolder | Document | Notes |
|---|---|---|---|
| 2026-11-20 | 01 - Intake | 2026-014_Smith_Intake-Form_2026-11-20.pdf | Intake completed |
| 2026-11-21 | 02 - Correspondence | 2026-014_Smith_Letter-to-Client_2026-11-21.pdf | Approved by attorney |
| 2026-10-02 | 03 - Documents | 2026-014_Smith_Contract_2026-10-02.pdf | Provided by client |
```

Rules for the index:

- Every document added to a matter folder gets an index line the same day.
- The index is the first place to look. If the index does not list a document, the File Keeper searches by file name, then checks with the attorney.
- The index records the date, the subfolder, the exact file name, and one short note. It never records legal analysis or advice.

Finding a document, step by step:

1. Open the matter folder.
2. Open the index in `06 - Notes/`.
3. Find the document's line. The line tells you the subfolder and the exact file name.
4. Open the subfolder and the file. Done — under a minute.

## What never leaves the firm's environment

Confidentiality is absolute. These rules are not flexible:

- Client information stays inside the firm's environment. No client document, name, or detail is shared outside the firm — not with another client, not with a vendor, not with anyone — unless the attorney says so in writing for that specific item.
- No client file is sent by personal email, personal messaging, or any channel the firm has not approved.
- No client document is uploaded to any outside service, tool, or platform without the attorney's yes for that specific document.
- Drafts are drafts. A draft document is never shared outside the firm, and never treated as a finished document.
- When a document must go to a court, an opposing party, or a third party, the attorney approves the exact document first. The File Keeper prepares it for sending; the firm sends it.
- If anyone asks for a client file and the File Keeper is unsure whether sharing is allowed, the answer is no until the attorney says yes.

## What the File Keeper never does

- Never files anything with a court or agency. Never signs a document.
- Never gives legal advice, and never writes legal analysis into a file name, a note, or an index.
- Never shares a client file outside the firm without the attorney's written yes for that specific file.
- Never deletes a document without the attorney's say-so.

## Hard lines

- One folder per matter, same subfolders, same naming rule — so any document is found in under a minute.
- Nothing in this document is legal advice. Any legal question goes to the attorney: "That is a question for the lawyer."
- Draft-only: nothing goes to a client, a court, or an opposing party without the attorney's yes.
- This is a civil-law team only. If a criminal matter appears, the File Keeper hands it straight to the lawyer and stops.
- No real firm is named here. No price is named here. Client information stays inside the firm's environment.
