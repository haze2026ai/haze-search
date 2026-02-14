import { startServer } from './presentation/httpServer.js';

const port = Number(process.env.PORT ?? 3000);
startServer(port);
