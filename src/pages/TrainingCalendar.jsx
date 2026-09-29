import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Grid, Column, ContentSwitcher, Switch, Tile, Tag, Button, Search, Link } from "@carbon/react";
import { Close, Launch } from "@carbon/icons-react";
import { EventCalendar, useInitialMonth } from "../components/EventCalendar.jsx";
import { ResourceTile } from "../components/ResourceTile.jsx";

const STATUS_TAG = { Confirmed: "green", Complete: "gray", Postponed: "magenta", "Coming Soon": "cyan" };
const QUARTERS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "Q1", label: "Q1" },
  { id: "Q2", label: "Q2" },
  { id: "Q3", label: "Q3" },
  { id: "Q4", label: "Q4" },
];

const pretty = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
const covers = (event, day) => event.start && day >= event.start && day <= (event.end || event.start);

function EventCard({ event, resource }) {
  return (
    <Tile className="event-card">
      <div className="event-card__head">
        <Tag size="sm" type={STATUS_TAG[event.status] || "gray"}>{event.status}</Tag>
        <span className="event-card__series">{event.series} · {event.format === "virtual" ? "Virtual" : "In person"}</span>
      </div>
      <h3 className="event-card__title">{event.title}</h3>
      <p className="event-card__when">{event.dateText} · {event.location}</p>
      <p className="event-card__desc">{event.description}</p>
      <p className="event-card__meta"><span className="label">Who it's for</span> {event.audience}</p>
      {resource && (
        <Link href={resource.actions[0].url} target="_blank" rel="noopener noreferrer" renderIcon={Launch}>
          About {resource.title}
        </Link>
      )}
      {event.status !== "Complete" && <p className="event-card__note">Registration flow to be confirmed — placeholder.</p>}
    </Tile>
  );
}

/** Training & calendar: dated events on a calendar, undated courses in their own view. */
export function TrainingCalendar({ catalogue }) {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "courses" ? "courses" : "calendar";
  const quarter = params.get("quarter") || "upcoming";
  const selected = params.get("date") || null;
  const q = params.get("q") || "";
  const today = new Date().toISOString().slice(0, 10);

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key); else next.set(key, value);
    if (key === "quarter") next.delete("date");
    setParams(next, { replace: true });
  };

  const events = catalogue.events || [];
  const [{ month, year }, setMonth] = useInitialMonth(events, today);
  const [monthState, setMonthState] = useState(null);
  const shown = monthState || { month, year };

  const section = catalogue.taxonomy.sections.find((s) => s.id === "training");
  const courses = catalogue.resources.filter((r) => r.section === "training");

  const listed = useMemo(() => {
    const sorted = [...events].sort((a, b) => (a.start || "9999-99-99").localeCompare(b.start || "9999-99-99"));
    if (selected) return sorted.filter((e) => covers(e, selected));
    if (quarter === "upcoming") return sorted.filter((e) => !e.start || e.start >= today);
    return sorted.filter((e) => e.quarter === quarter);
  }, [events, selected, quarter, today]);

  const filteredCourses = courses.filter((r) => !q || [r.title, r.description, r.purpose, ...r.keywords].join(" ").toLowerCase().includes(q.toLowerCase()));

  const heading = selected ? pretty(selected) : quarter === "upcoming" ? "Upcoming" : `${quarter} 2026`;

  return (
    <Grid className="page">
      <Column sm={4} md={8} lg={12}>
        <p className="eyebrow">Browse resources · I know what I'm looking for</p>
        <h1 className="page-title page-title--sm">{section?.label || "Training & calendar"}</h1>
        <p className="page-lede">{section?.blurb}</p>
      </Column>

      <Column sm={4} md={8} lg={16} className="browse-controls">
        <ContentSwitcher selectedIndex={view === "courses" ? 1 : 0} onChange={({ name }) => set("view", name === "calendar" ? null : name)} size="md" className="browse-modes">
          <Switch name="calendar" text={`Calendar (${events.length})`} />
          <Switch name="courses" text={`Courses (${courses.length})`} />
        </ContentSwitcher>
      </Column>

      {view === "calendar" ? (
        <>
          <Column sm={4} md={8} lg={6} className="cal-col">
            <EventCalendar events={events} month={shown.month} year={shown.year} today={today}
              onMonth={(m, y) => setMonthState({ month: m, year: y })}
              selected={selected} onSelect={(day) => set("date", day)} />
          </Column>

          <Column sm={4} md={8} lg={10}>
            <div className="events-head">
              <h2 className="block__title">{heading} <span className="events-head__count">{listed.length}</span></h2>
              {selected
                ? <Button kind="ghost" size="sm" renderIcon={Close} onClick={() => set("date", null)}>Clear date</Button>
                : (
                  <ContentSwitcher selectedIndex={Math.max(0, QUARTERS.findIndex((x) => x.id === quarter))} onChange={({ name }) => set("quarter", name === "upcoming" ? null : name)} size="sm">
                    {QUARTERS.map((x) => <Switch key={x.id} name={x.id} text={x.label} />)}
                  </ContentSwitcher>
                )}
            </div>
            {listed.length === 0 ? (
              <Tile className="empty-state"><h2>Nothing scheduled here</h2><p>Pick another date or quarter — or see what's coming up.</p>
                <Button kind="tertiary" size="md" onClick={() => { set("date", null); set("quarter", null); }}>Show upcoming</Button>
              </Tile>
            ) : (
              <div className="events-list">
                {listed.map((e) => <EventCard key={e.id} event={e} resource={catalogue.resources.find((r) => r.id === e.resourceId)} />)}
              </div>
            )}
            <p className="panel__note">Events announced without a date ({events.filter((e) => !e.start).length}) are listed last and don't appear on the grid.</p>
          </Column>
        </>
      ) : (
        <>
          <Column sm={4} md={8} lg={16} className="browse-controls">
            <Search labelText="Search courses" placeholder="Search courses and programmes" value={q} onChange={(e) => set("q", e.target.value)} size="lg" />
            <p className="browse-count">{filteredCourses.length} of {courses.length} courses</p>
          </Column>
          {filteredCourses.map((r) => (
            <Column key={r.id} sm={4} md={4} lg={5} className="browse-col">
              <ResourceTile resource={r} taxonomy={catalogue.taxonomy} />
            </Column>
          ))}
        </>
      )}
    </Grid>
  );
}
