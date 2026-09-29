import { Routes, Route, Link, useLocation, useSearchParams } from "react-router-dom";
import {
  Theme, Header, HeaderContainer, HeaderName, HeaderMenuButton, SkipToContent,
  SideNav, SideNavItems, SideNavLink, SideNavMenu, SideNavMenuItem, SideNavDivider, Content, Tag,
} from "@carbon/react";
import { Home } from "./pages/Home.jsx";
import { Browse } from "./pages/Browse.jsx";
import { DealAccelerator } from "./pages/DealAccelerator.jsx";
import { VersionFooter } from "./components/VersionFooter.jsx";
import { useCatalogue } from "./api/useCatalogue.js";

/** The rail is the hub's structure: areas first, then the catalogue's own sections. */
function Rail({ isSideNavExpanded, onLinkClick }) {
  const { catalogue } = useCatalogue();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const section = params.get("section") || "";
  const onBrowse = pathname.startsWith("/browse");

  return (
    <SideNav aria-label="Activation Hub sections" expanded={isSideNavExpanded} isPersistent isRail={false} isChildOfHeader>
      <SideNavItems>
        <SideNavLink as={Link} to="/" isActive={pathname === "/"} onClick={onLinkClick}>Home</SideNavLink>
        <SideNavLink as={Link} to="/browse" isActive={onBrowse && !section} onClick={onLinkClick}>All resources</SideNavLink>
        <SideNavDivider />
        <SideNavMenu title="Sections" defaultExpanded>
          {catalogue?.taxonomy.sections.map((s) => (
            <SideNavMenuItem key={s.id} as={Link} to={`/browse?section=${s.id}`} isActive={section === s.id} onClick={onLinkClick}>
              {s.label}
            </SideNavMenuItem>
          ))}
        </SideNavMenu>
        <SideNavDivider />
        <SideNavLink as={Link} to="/accelerator" isActive={pathname.startsWith("/accelerator")} onClick={onLinkClick}>
          Deal Accelerator <Tag size="sm" type="blue" className="rail-tag">Preview</Tag>
        </SideNavLink>
      </SideNavItems>
    </SideNav>
  );
}

export function App() {
  return (
    <>
      <Theme theme="g100">
        <HeaderContainer render={({ isSideNavExpanded, onClickSideNavExpand }) => (
          <>
            <Header aria-label="AIIS Activation Hub">
              <SkipToContent />
              <HeaderMenuButton aria-label={isSideNavExpanded ? "Close menu" : "Open menu"} onClick={onClickSideNavExpand} isActive={isSideNavExpanded} isCollapsible />
              <HeaderName as={Link} to="/" prefix="IBM Consulting">AIIS Activation Hub</HeaderName>
            </Header>
            <Theme theme="white">
              <Rail isSideNavExpanded={isSideNavExpanded} onLinkClick={isSideNavExpanded ? onClickSideNavExpand : undefined} />
            </Theme>
          </>
        )} />
      </Theme>
      <Content id="main-content" className="hub-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/accelerator" element={<DealAccelerator />} />
          <Route path="*" element={<Home />} />
        </Routes>
        <VersionFooter />
      </Content>
    </>
  );
}
