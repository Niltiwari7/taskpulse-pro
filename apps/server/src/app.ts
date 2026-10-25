import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './modules/auth/auth.routes'
import workspaceRouter from './modules/workspace/workspace.routes'
import path from 'node:path'
import boardRouter from './modules/board/board.route';
const app = express();

// Render terminates TLS at its proxy
app.set('trust proxy', 1);

app.use(
  cors({
    // Cookies need an explicit origin + credentials; the default '*' is rejected by browsers
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(cookieParser());


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/workspaces', workspaceRouter);
app.use('/api/v1/boards', boardRouter);


app.get('/api/v1/health', (_req,res) => {
  res.json({ status: 'ok' })
})

if(process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(import.meta.dirname, '../../client/dist')
  app.use(express.static(clientDist));
  // SPA fallback: anything that is not /api goes to index.html
   app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

export default app;