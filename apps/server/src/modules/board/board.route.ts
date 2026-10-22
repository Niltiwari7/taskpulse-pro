import { Router } from "express";
import { requireAuth } from "../../middleware/requiredAuth";
import { getBoards } from "./board.controller";

const boardRouter = Router();

boardRouter.post('/boards/:boardId',requireAuth, getBoards);

export default boardRouter