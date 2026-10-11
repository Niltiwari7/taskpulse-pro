import {Router} from 'express'
import { register, login, getMe, logout } from './auth.controller'
import { requireAuth } from '../../middleware/requiredAuth'

const authRouter = Router()

authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.get('/me', requireAuth, getMe);
authRouter.post("/logout",logout);


export default authRouter