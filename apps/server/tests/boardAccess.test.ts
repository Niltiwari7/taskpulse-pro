import { describe, expect, it } from 'vitest';
import { canAccessBoard, canEditBoardContent, type BoardAccessUser } from '../src/modules/board/board.access';

// `satisfies` keeps the exact keys, so a label in `table` that doesn't match a key here is a type error.
const users = {
  '1 anonymous': null,
  '2 stranger': { workspaceRole: null, boardRole: null },
  '3 workspace member': { workspaceRole: 'MEMBER', boardRole: null },
  '4 workspace admin': { workspaceRole: 'ADMIN', boardRole: null },
  '5 workspace + board member': { workspaceRole: 'MEMBER', boardRole: 'MEMBER' },
  '6 guest': { workspaceRole: null, boardRole: 'GUEST' },
  '7 workspace member + board observer': { workspaceRole: 'MEMBER',  boardRole: 'OBSERVER' },
} satisfies Record<string, BoardAccessUser | null>;

// Mirrors the truth table in docs/permissions.md — keep them in sync.
//  user                          PRIVATE WORKSPACE PUBLIC
const table = [
  ['1 anonymous',                 false,  false,    true],
  ['2 stranger',                  false,  false,    true],
  ['3 workspace member',          false,  true,     true],
  ['4 workspace admin',           true,   true,     true],
  ['5 workspace + board member',  true,   true,     true],
  ['6 guest',                     true,   true,     true],
  ['7 workspace member + board observer', true, true, true],
] as const;

describe('canAccessBoard', () => {
  describe.each(table)('%s', (who, privateAccess, workspaceAccess, publicAccess) => {
    it.each([
      ['PRIVATE', privateAccess],
      ['WORKSPACE', workspaceAccess],
      ['PUBLIC', publicAccess],
    ] as const)('%s board → %s', (visibility, expected) => {
      expect(canAccessBoard(users[who],{ visibility })).toBe(expected);
    });
  });
});

// Mirrors the "List routes" actors in docs/permissions.md: only roles that can see the board.
//  workspace role  board role   can edit
const editTable = [
  [null,     'GUEST',    true],
  ['MEMBER', null,       false], // ws MEMBER not on the board: reads only
  ['ADMIN',  null,       true],
  ['MEMBER', 'ADMIN',    true],
  ['MEMBER', 'MEMBER',   true],
  ['MEMBER', 'OBSERVER', false],
  ['ADMIN',  'OBSERVER', true],  // workspace ADMIN wins over a lower board role
] as const;

describe('canEditBoardContent', () => {
  it.each(editTable)('workspace %s + board %s → %s', (workspaceRole, boardRole, expected) => {
    expect(canEditBoardContent({ workspaceRole, boardRole })).toBe(expected);
  });
});
