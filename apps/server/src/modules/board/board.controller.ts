import {Request, Response, NextFunction} from 'express';
import {db} from '../../prisma/db';
import {canAccessBoard} from './board.access';

export const getBoards = async(req: Request, res: Response, next: NextFunction) => {
  try{
   const { boardId } = req.params;

   if(typeof boardId !== 'string' || !boardId.trim()){
     res.status(400).json({
       error: {
         code: 'VALIDATION_ERROR',
         message: 'Invalid board id.',
       },
     });
     return;
   }

   // Find the board by Id
   const board = await db.orm.public.Board.where({ id: boardId}).first();
   
   if(!board){
     res.status(404).json({
       error: {
         code: 'BOARD_NOT_FOUND',
         message: 'Board not found.',
       },
     });
     return;
   }
   
   // requireAuth guarantees req.user
   const userId = req.user!.id;

   // Lookup the user's role in the board's workspace (null = not a member)
   const workspaceMember = await db.orm.public.WorkspaceMember.where({
     workspaceId: board.workspaceId,
     userId,
   }).first();
   const workspaceRole = workspaceMember?.role ?? null;

   // Lookup the user's role on this board (null = not a member)
   const boardMember = await db.orm.public.BoardMember.where({
     boardId: board.id,
     userId,
   }).first();
   const boardRole = boardMember?.role ?? null;

   // 404 rather than 403 so we don't leak that the board exists
   if(!canAccessBoard({ workspaceRole, boardRole }, board)){
     res.status(404).json({
       error: {
         code: 'BOARD_NOT_FOUND',
         message: 'Board not found.',
       },
     });
     return;
   }

   res.status(200).json({ board, workspaceRole, boardRole });
  }catch(error){
    next(error);
  }
}