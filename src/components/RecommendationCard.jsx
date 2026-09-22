import { Tile, UnorderedList, ListItem } from "@carbon/react";
import { WarningAlt } from "@carbon/icons-react";
import { ResourceTags } from "./ResourceTags.jsx";
import { ResourceActions } from "./ResourceActions.jsx";

const TIME = { minutes: "Minutes", hours: "A few hours", days: "Days", weeks: "Weeks" };
const LEVEL = { none: "No technical skills", basic: "Basic", intermediate: "Intermediate", advanced: "Advanced" };

export function RecommendationCard({ item, rank }) {
  return (
    <Tile className={`rec-card${rank === 0 ? " rec-card--lead" : ""}`}>
      <ResourceTags {...item} />
      <h3 className="rec-card__title">{item.title}</h3>

      <div className="rec-card__why">
        <p className="label">Why this fits</p>
        <p>{item.whyItFits}</p>
      </div>

      <dl className="rec-card__facts">
        <div><dt>Best for</dt><dd>{item.bestFor}</dd></div>
        <div><dt>What you can do</dt><dd>{item.whatYouCanDo}</dd></div>
        <div><dt>Time to value</dt><dd>{TIME[item.timeToValue]}</dd></div>
        <div><dt>Technical level</dt><dd>{LEVEL[item.technicalLevel]}</dd></div>
      </dl>

      {item.prerequisites.length > 0 && (
        <div className="rec-card__block">
          <p className="label">Before you start</p>
          <UnorderedList>{item.prerequisites.map((p) => <ListItem key={p}>{p}</ListItem>)}</UnorderedList>
        </div>
      )}

      {item.caveats.length > 0 && (
        <div className="rec-card__caveats">
          {item.caveats.map((c) => <p key={c}><WarningAlt size={16} /> {c}</p>)}
        </div>
      )}

      {item.sessions?.length > 0 && (
        <div className="rec-card__block">
          <p className="label">Upcoming sessions</p>
          <UnorderedList>{item.sessions.map((s) => <ListItem key={s.date + s.location}>{s.date} · {s.location} ({s.status})</ListItem>)}</UnorderedList>
        </div>
      )}

      <ResourceActions actions={item.actions} source={item.authoritativeSource} size={rank === 0 ? "md" : "sm"} />
      {item.contact && <p className="rec-card__contact">Contact: {item.contact.name}{item.contact.role ? ` — ${item.contact.role}` : ""}</p>}
    </Tile>
  );
}
