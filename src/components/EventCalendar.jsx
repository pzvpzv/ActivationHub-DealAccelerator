import { useMemo, useState } from "react";
import { Button } from "@carbon/react";
import { ChevronLeft, ChevronRight } from "@carbon/icons-react";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** An event covers every day from start to end, so a multi-day lab shows on each of its days. */
const covers = (event, day) => event.start && day >= event.start && day <= (event.end || event.start);

/** Month grid. Days that hold events are selectable; selecting one filters the list beside it. */
export function EventCalendar({ events, month, year, onMonth, selected, onSelect, today }) {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = useMemo(() => {
    const list = Array.from({ length: firstWeekday }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      const day = iso(year, month, d);
      list.push({ d, day, events: events.filter((e) => covers(e, day)) });
    }
    return list;
  }, [events, month, year, firstWeekday, daysInMonth]);

  const step = (delta) => {
    const next = new Date(year, month + delta, 1);
    onMonth(next.getMonth(), next.getFullYear());
  };

  return (
    <div className="cal">
      <div className="cal__head">
        <h3 className="cal__label">{MONTH_NAMES[month]} {year}</h3>
        <div className="cal__nav">
          <Button kind="ghost" size="sm" hasIconOnly iconDescription="Previous month" renderIcon={ChevronLeft} onClick={() => step(-1)} />
          <Button kind="ghost" size="sm" hasIconOnly iconDescription="Next month" renderIcon={ChevronRight} onClick={() => step(1)} />
        </div>
      </div>
      <div className="cal__grid" role="grid" aria-label={`${MONTH_NAMES[month]} ${year}`}>
        {DAY_NAMES.map((d) => <div key={d} className="cal__dayname" role="columnheader">{d}</div>)}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`pad-${i}`} className="cal__cell cal__cell--empty" />;
          const has = cell.events.length > 0;
          const isPast = cell.day < today;
          const classes = ["cal__cell", has && "cal__cell--has", cell.day === selected && "cal__cell--selected", cell.day === today && "cal__cell--today", isPast && "cal__cell--past"].filter(Boolean).join(" ");
          return (
            <button key={cell.day} type="button" className={classes} disabled={!has}
              aria-pressed={cell.day === selected}
              aria-label={`${cell.d} ${MONTH_NAMES[month]}${has ? `, ${cell.events.length} event${cell.events.length > 1 ? "s" : ""}` : ", no events"}`}
              onClick={() => onSelect(cell.day === selected ? null : cell.day)}>
              <span className="cal__date">{cell.d}</span>
              {has && <span className="cal__dots">{cell.events.slice(0, 3).map((e) => <span key={e.id} className={`cal__dot cal__dot--${e.status.toLowerCase().replace(" ", "-")}`} />)}</span>}
            </button>
          );
        })}
      </div>
      <p className="cal__legend">
        <span className="cal__dot cal__dot--confirmed" /> Confirmed
        <span className="cal__dot cal__dot--complete" /> Complete
        <span className="cal__dot cal__dot--postponed" /> Postponed
      </p>
    </div>
  );
}

/** Finds the first month that actually holds an event, so the grid never opens empty. */
export function useInitialMonth(events, today) {
  return useState(() => {
    const now = new Date(`${today}T00:00:00`);
    const upcoming = events.filter((e) => e.start && e.start >= today).sort((a, b) => a.start.localeCompare(b.start))[0];
    const anchor = upcoming ? new Date(`${upcoming.start}T00:00:00`) : now;
    return { month: anchor.getMonth(), year: anchor.getFullYear() };
  });
}
