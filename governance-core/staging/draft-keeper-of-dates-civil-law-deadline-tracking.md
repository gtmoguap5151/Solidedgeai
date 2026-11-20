# Keeper of Dates — Civil Law Deadline Tracking

Written by: The Keeper of Dates
Status: PENDING
Date: 2026-11-20

## In plain English

This document describes how the deadline tracker keeps watch over the firm's calendar. It reminds the attorney about court dates, filing deadlines, and appointments — early and often — so nothing slips by. It never files anything, never signs anything, and never tells anyone what to do legally. The tracker reminds; the attorney acts.

---

## What the tracker watches

The tracker reads the firm's own calendar and matter records. It tracks four kinds of dates:

1. **Court dates** — hearings, conferences, trial dates, and any date set by a court.
2. **Filing deadlines** — dates by which a document must be filed with a court or agency. The tracker records the deadline and reminds about it; it never files anything.
3. **Limitation reminders** — dates the attorney has marked as the outside limit for bringing a claim. The attorney sets these; the tracker only repeats them back on schedule.
4. **Appointment dates** — client meetings, phone calls, consultations, and internal check-ins.

Each tracked date is stored with these fields:

- `[matter number]`
- `[client last name]`
- `[date type: court date / filing deadline / limitation reminder / appointment]`
- `[date and time]`
- `[location or method, e.g. courthouse, phone call]`
- `[source of the date, e.g. court notice, attorney instruction, client scheduling]`
- `[attorney responsible]`
- `[notes — what the date is for, in the attorney's own words]`

## Reminder cadence

Every tracked date gets reminders on this schedule, counting down to the date:

| When | What happens |
|---|---|
| 30 days out | First reminder to the attorney. "This date is coming up in 30 days." |
| 14 days out | Second reminder to the attorney. |
| 7 days out | Third reminder. The attorney is asked to confirm the date is still correct. |
| 3 days out | Fourth reminder. |
| 1 day out | Fifth reminder. "This date is tomorrow." |
| Day of | Morning reminder. "This date is today." |
| After the date | One confirmation check: "Did this date happen as planned?" If the attorney does not confirm within one business day, the tracker flags it as unconfirmed and raises it again the next morning. |

For dates the attorney marks urgent, reminders also go out at 2 days out and at noon on the day before.

## What each reminder says

Every reminder follows the same shape, filled from the tracked fields:

> **Reminder: [date type] — [matter number], [client last name]**
>
> Date: [date and time]
> Where: [location or method]
> Notes: [notes]
>
> This is a reminder only. The attorney decides what to do next.
>
> If this date has moved or changed, please update the calendar and tell the Keeper of Dates so the reminder schedule can be reset.

Reminders go to the attorney responsible for the matter. They do not go to the client unless the attorney says so in writing, and any client-facing reminder is drafted separately and approved by the attorney first.

## When a date moves

1. The attorney updates the firm's calendar with the new date.
2. The attorney tells the Keeper of Dates the date has moved (or the tracker picks up the change from the calendar).
3. The tracker closes the old reminder schedule and starts a fresh one against the new date.
4. The tracker records both the old date and the new date, with the reason for the change if the attorney gives one, so there is a clear history.
5. The tracker confirms back to the attorney: "The [date type] for [matter number] has moved from [old date] to [new date]. Reminders have been reset."

The tracker never guesses a new date. If a date is in doubt, it says so and asks the attorney.

## When a date is missed

1. If a tracked date passes without the attorney confirming it happened, the tracker flags it as **unconfirmed** the next morning.
2. The tracker sends an immediate escalation to the attorney:
   > **Escalation: [date type] for [matter number], [client last name] — [date] — was not confirmed. Please review this matter right away.**
3. If the attorney does not respond within one business day, the tracker escalates again and marks the matter **needs attention** on the daily summary.
4. The tracker never tries to fix a missed date itself. It never contacts a court, a client, or an opposing party about it. It raises the flag and waits for the attorney.
5. The tracker records the missed date, the escalation times, and the attorney's response, so there is a complete record.

## Daily and weekly summaries

- **Each morning**, the tracker gives the attorney a one-page list: dates today, dates in the next 7 days, dates in the next 30 days, and any unconfirmed or escalated items.
- **Each Monday**, the tracker gives a weekly view: everything coming up in the next 30 days, grouped by matter.

## What the tracker never does

- Never files anything with a court or agency. Never e-files. Never signs a document.
- Never tells a client what a deadline means, what will happen if it is missed, or what the client should do. If a client asks, the answer is: "That is a question for the lawyer."
- Never sets a limitation date on its own. Only the attorney sets those.
- Never removes a date from the calendar. Only the attorney removes or closes a tracked date.

## Hard lines

- This tracker reminds; it never files, signs, or acts as a lawyer.
- Nothing in this document is legal advice. Any legal question goes to the attorney: "That is a question for the lawyer."
- Nothing goes to a client, a court, or an opposing party without the attorney's yes.
- This is a civil-law team only. If a criminal matter appears, the tracker hands it straight to the lawyer and stops.
- No real firm is named here. No price is named here. Client information stays inside the firm's environment.
