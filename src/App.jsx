import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Theme, Header, HeaderContainer, HeaderName, HeaderNavigation, HeaderMenuButton, HeaderMenuItem, SkipToContent, SideNav, SideNavItems, HeaderSideNavItems, Content } from "@carbon/react";
import { Home } from "./pages/Home.jsx";
import { Browse } from "./pages/Browse.jsx";
import { DealAccelerator } from "./pages/DealAccelerator.jsx";

const nav = (pathname) => [
  <HeaderMenuItem key="accelerator" as={Link} to="/accelerator" isActive={pathname.startsWith("/accelerator")}>Deal Accelerator</HeaderMenuItem>,
  <HeaderMenuItem key="browse" as={Link} to="/browse" isActive={pathname.startsWith("/browse")}>Browse resources</HeaderMenuItem>,
];

export function App() {
  const { pathname } = useLocation();
  return (
    <>
      <Theme theme="g100">
        <HeaderContainer render={({ isSideNavExpanded, onClickSideNavExpand }) => (
          <Header aria-label="AIIS Activation Hub">
            <SkipToContent />
            <HeaderMenuButton aria-label={isSideNavExpanded ? "Close menu" : "Open menu"} onClick={onClickSideNavExpand} isActive={isSideNavExpanded} />
            <HeaderName as={Link} to="/" prefix="IBM Consulting">AIIS Activation Hub</HeaderName>
            <HeaderNavigation aria-label="AIIS Activation Hub">{nav(pathname)}</HeaderNavigation>
            <SideNav aria-label="Side navigation" expanded={isSideNavExpanded} isPersistent={false} onSideNavBlur={onClickSideNavExpand}>
              <SideNavItems><HeaderSideNavItems>{nav(pathname)}</HeaderSideNavItems></SideNavItems>
            </SideNav>
          </Header>
        )} />
      </Theme>
      <Content id="main-content" className="hub-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/accelerator" element={<DealAccelerator />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Content>
    </>
  );
}
