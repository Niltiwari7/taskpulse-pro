import {Router} from 'express';
import {requireAuth} from '../../middleware/requiredAuth';

import {updateList} from './list.controller';

const listRouter = Router();

listRouter.use(requireAuth);

// Access checks need the list's board, so each handler does them itself (loadEditableList).
listRouter.patch('/:listId', updateList);

export default listRouter;
