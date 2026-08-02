import { configureOpenApi } from "./lib/configure-open-api.js";
import { createApp } from "./lib/create-app.js";

const app = createApp();

configureOpenApi(app);

export default app;
