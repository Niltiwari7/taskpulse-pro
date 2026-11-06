import {Router} from 'express';
import {requireAuth} from '../../middleware/requiredAuth';

import {archiveList, moveList, updateList,createCard} from './list.controller';

const listRouter = Router();

listRouter.use(requireAuth);

// Access checks need the list's board, so each handler does them itself (loadEditableList).
listRouter.patch('/:listId', updateList);
listRouter.patch('/:listId/move', moveList);
listRouter.delete('/:listId', archiveList);
listRouter.post('/:listId/cards', createCard);

export default listRouter;
