import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './modules/auth/auth.routes'
import workspaceRouter from './modules/workspace/workspace.routes'
const app = express();

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


app.get('/api/v1/health', (_req,res) => {
  res.json({ status: 'ok' })
})

export default app;