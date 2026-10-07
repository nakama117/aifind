import { defineServerModule } from "@aihot/backend/modules";
import { registerPreviewRoutes } from "./preview/routes.ts";
import { registerAdminRoutes } from "./admin/routes.ts";
import { registerPublicRoutes } from "./public/routes.ts";
import { observeQueue, detectQueue, detectorEnabled, enqueueDueMonitors } from './detector/jobs.ts';
import { registerDetectorRoutes } from './detector/routes.ts';
import { registerEditorialAdminRoutes } from './editorial/routes.ts';
import { registerEditorialPublicRoutes } from './public/editorial-routes.ts';
import { registerEditorialAssetRoutes } from './editorial/asset-routes.ts';
import {pruneObservations} from './detector/retention.ts';
import {registerLaunchRoutes} from './launch/routes.ts';

export const aifindServer = defineServerModule({ name: "aifind",
  retention:pruneObservations,
  models: { aifindResolver: { label: 'AIFIND 製品同定', env: 'AIFIND_RESOLVER_MODEL', purposes: ['aifind.resolve'] },
    aifindDetector: { label: 'AIFIND 製品変更提案', env: 'AIFIND_DETECTOR_MODEL', purposes: ['aifind.detect'] } },
  queues: [observeQueue, detectQueue], schedules: [{ name: 'aifind.monitors', cron: '*/15 * * * *', when: detectorEnabled, missed: 'skip', run: enqueueDueMonitors }], http: app => {
  registerPreviewRoutes(app);
  registerLaunchRoutes(app);
  registerAdminRoutes(app);
  registerPublicRoutes(app);
  registerDetectorRoutes(app);
  registerEditorialAdminRoutes(app);
  registerEditorialPublicRoutes(app);
  registerEditorialAssetRoutes(app);
}, sitemap: { files: ["/sitemap-products.xml", "/sitemap-aifind-editorial.xml"], pages: [{ loc: "/products", changefreq: "daily", priority: 0.8 }] } });
