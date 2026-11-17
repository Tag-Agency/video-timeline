#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, VERSION } from "./server.js";

async function main() {
  if (process.argv.includes("--version")) {
    console.log(VERSION);
    return;
  }
  const server = createServer();
  await server.connect(new StdioServerTransport());
  // stdout è riservato al protocollo MCP: i log vanno su stderr.
  console.error(`silo engine ${VERSION} pronto`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
