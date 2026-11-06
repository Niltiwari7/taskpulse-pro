import { Router } from "express";
import { requireAuth } from "../../middleware/requiredAuth";
import { archiveCard, getCard, updateCard } from "./card.controller";

const cardRouter = Router();

cardRouter.use(requireAuth);

cardRouter.get('/:cardId', getCard);
cardRouter.patch('/:cardId', updateCard);
cardRouter.patch('/:cardId', archiveCard)

export default cardRouter;