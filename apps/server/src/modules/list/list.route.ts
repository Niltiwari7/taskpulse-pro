import {Router} from 'express';
import {requireAuth} from '../../middleware/requiredAuth';

import {archiveList, updateList} from './list.controller';

const listRouter = Router();

listRouter.use(requireAuth);

// Access checks need the list's board, so each handler does them itself (loadEditableList).
listRouter.patch('/:listId', updateList);
listRouter.delete('/:listId', archiveList);

export default listRouter;
