export type Route = "home" | "settings";

const ROUTE_HASHES: Record<Route, string> = {
  home: "",
  settings: "#/settings",
};

function parseRoute(hash: string): Route {
  if (hash.startsWith("#/settings")) return "settings";
  return "home";
}

export interface Router {
  current(): Route;
  navigate(route: Route): void;
  onChange(listener: (route: Route) => void): () => void;
}

export function createRouter(): Router {
  let route = parseRoute(window.location.hash);
  const listeners = new Set<(route: Route) => void>();

  apply();

  function apply(): void {
    document.documentElement.dataset.route = route;
  }

  function emit(): void {
    for (const listener of listeners) {
      listener(route);
    }
  }

  window.addEventListener("hashchange", () => {
    const next = parseRoute(window.location.hash);
    if (next === route) return;
    route = next;
    apply();
    emit();
  });

  return {
    current() {
      return route;
    },
    navigate(next) {
      if (next === route) return;
      window.location.hash = ROUTE_HASHES[next];
    },
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
