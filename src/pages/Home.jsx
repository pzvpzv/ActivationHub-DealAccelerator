import { Link as RouterLink } from "react-router-dom";
import { Grid, Column, ClickableTile, Link } from "@carbon/react";
import { ArrowRight, Launch } from "@carbon/icons-react";
import { useCatalogue } from "../api/useCatalogue.js";

export function Home() {
  const { catalogue } = useCatalogue();
  return (
    <Grid className="page">
      <Column sm={4} md={8} lg={12}>
        <p className="eyebrow">IBM Consulting · AI Integration Services</p>
        <h1 className="page-title">AIIS Activation Hub</h1>
        <p className="page-lede">Everything AIIS has published to help you with a client — decks, templates, accelerators, recordings, labs and events. Start from what you're trying to do, or browse what's there.</p>
      </Column>

      <Column sm={4} md={4} lg={8} className="entry-col">
        <ClickableTile as={RouterLink} to="/accelerator" className="entry-tile entry-tile--primary">
          <p className="entry-tile__kicker">Deal Accelerator</p>
          <h2 className="entry-tile__title">I know what I'm trying to accomplish</h2>
          <p className="entry-tile__body">Describe your client need in your own words. The hub works out what fits from the AIIS inventory, explains why, and takes you to the source.</p>
          <span className="entry-tile__cta">Describe your need <ArrowRight /></span>
        </ClickableTile>
      </Column>
      <Column sm={4} md={4} lg={8} className="entry-col">
        <ClickableTile as={RouterLink} to="/browse" className="entry-tile">
          <p className="entry-tile__kicker">Browse resources</p>
          <h2 className="entry-tile__title">I know what I'm looking for</h2>
          <p className="entry-tile__body">Search and filter the full inventory{catalogue ? ` — ${catalogue.resources.length} resources` : ""} by type, capability and industry.</p>
          <span className="entry-tile__cta">Browse the inventory <ArrowRight /></span>
        </ClickableTile>
      </Column>

      {catalogue?.hubUrl && (
        <Column sm={4} md={8} lg={16} className="home-footer">
          <p>Looking for the event calendar, curriculum, FAQs or community pages? They stay on the current Activation Hub.{" "}
            <Link href={catalogue.hubUrl} target="_blank" rel="noopener noreferrer" renderIcon={Launch}>Open the current Activation Hub</Link>
          </p>
        </Column>
      )}
    </Grid>
  );
}
