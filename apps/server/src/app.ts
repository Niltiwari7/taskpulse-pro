import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './modules/auth/auth.routes'
const app = express();

app.use(cors());
app.use(cookieParser());


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/auth', authRouter);


app.get('/api/v1/health', (_req,res) => {
  res.json({ status: 'ok' })
})

export default app;