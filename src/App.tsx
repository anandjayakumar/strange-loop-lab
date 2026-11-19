import { useEffect, useState } from "react";
import { SiteHeader } from "./components/SiteHeader";
import { HomePage } from "./home/HomePage";
import { PaperPage } from "./paper/PaperPage";
import { FindingsPage } from "./research/FindingsPage";
import { ResearchLabPage } from "./research/ResearchLabPage";
import {
  navigateTo,
  parseRoute,
  subscribeToRoute,
  type RouteState,
} from "./lib/router";

export default function App() {
  const [route, setRoute] = useState<RouteState>(() => parseRoute());

  useEffect(() => subscribeToRoute(() => setRoute(parseRoute())), []);

  useEffect(() => {
    // Our router owns scroll position; the browser's restoration would
    // otherwise override a deep link on reload.
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    const titles: Record<RouteState["name"], string> = {
      home: "Strange Loop Lab — when self-models trap themselves",
      research: "Interactive simulation lab — Strange Loop Lab",
      findings: "Scientific findings — Strange Loop Lab",
      paper: "Manuscript — Strange Loop Lab",
    };
    document.title = titles[route.name];
  }, [route.name]);

  useEffect(() => {
    if (!route.hash) {
      window.scrollTo({ top: 0 });
      return;
    }

    let cancelled = false;
    const scrollToTarget = () => {
      if (cancelled) return;
      const target = document.getElementById(route.hash);
      if (!target) return;
      // Route changes should land instantly; CSS smooth scrolling would
      // animate a multi-thousand-pixel jump on long pages.
      const root = document.documentElement;
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      target.scrollIntoView({ block: "start" });
      root.style.scrollBehavior = previous;
    };

    // One frame for layout, then a delayed pass in case the browser restores
    // scroll position after the first paint.
    const frame = window.requestAnimationFrame(scrollToTarget);
    const timer = window.setTimeout(scrollToTarget, 120);
    window.addEventListener("load", scrollToTarget, { once: true });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("load", scrollToTarget);
    };
  }, [route.name, route.version, route.hash]);

  const navigate = (target: string) => navigateTo(target);

  return (
    <div>
      {route.name === "home" ? null : (
        <SiteHeader active={route.name} onNavigate={navigate} />
      )}

      {route.name === "home" ? <HomePage onNavigate={navigate} /> : null}

      {route.name === "research" ? (
        <ResearchLabPage version={route.version} onNavigate={navigate} />
      ) : null}

      {route.name === "findings" ? (
        <FindingsPage
          onOpenVersion={(version) => navigate(`/research?version=${version}`)}
          onBack={() => navigate("/research")}
          onNavigate={navigate}
        />
      ) : null}

      {route.name === "paper" ? <PaperPage onNavigate={navigate} /> : null}
    </div>
  );
}
