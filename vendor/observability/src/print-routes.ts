interface RouteInfo {
  method: string;
  path: string;
}

interface PrintRoutesOptions {
  port: number;
  service: string;
}

export function printRouteTable(
  routes: RouteInfo[],
  opts: PrintRoutesOptions
): void {
  const { service, port } = opts;

  if (routes.length === 0) {
    console.log(`\n Route (${service}) - :${port}\n   No routes registered\n`);
    return;
  }

  const maxMethodLen = Math.max(...routes.map((r) => r.method.length));

  console.log(`\n Route (${service}) - :${port}`);

  routes.forEach((route, i) => {
    const isFirst = i === 0;
    const isLast = i === routes.length - 1;
    const connector = isFirst ? "\u250c" : isLast ? "\u2514" : "\u251c";

    const symbol = route.method === "GET" ? "\u25cb" : "\u0192";
    const method = route.method.padEnd(maxMethodLen);

    console.log(` ${connector} ${symbol} ${method}  ${route.path}`);
  });

  console.log("\n \u25cb  read   \u0192  handler\n");
}
