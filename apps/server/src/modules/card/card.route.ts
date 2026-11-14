import { Router } from "express";
import { requireAuth } from "../../middleware/requiredAuth";
import { archiveCard, deleteCard, getCard, moveCardHandler, updateCard } from "./card.controller";

const cardRouter = Router();

cardRouter.use(requireAuth);

// Access checks need the card's board, so each handler does them itself (loadCard).
cardRouter.get('/:cardId', getCard);
cardRouter.patch('/:cardId', updateCard);
cardRouter.post('/:cardId/archive', archiveCard);
cardRouter.delete('/:cardId', deleteCard);
cardRouter.patch('/:cardId/move', moveCardHandler)

export default cardRouter;