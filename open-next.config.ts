import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every route is dynamic (auth cookie / live availability), so no incremental cache is configured.
export default defineCloudflareConfig({});
