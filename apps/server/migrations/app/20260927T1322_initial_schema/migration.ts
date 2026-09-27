#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/45a12f64929c908c8fb0104192d371699b8d86e1d9feb960031d7cc149b49bd9/contract';
import endContract from '../../snapshots/45a12f64929c908c8fb0104192d371699b8d86e1d9feb960031d7cc149b49bd9/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'Activity',
        columns: [
          col('actionType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('boardId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('cardId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('details', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Attachment',
        columns: [
          col('cardId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fileName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fileType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fileUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('uploadedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Board',
        columns: [
          col('backgroundColorOrUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('visibility', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Board_visibility_check_49087bbc',
            "\"visibility\" IN ('PRIVATE', 'WORKSPACE', 'PUBLIC')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'BoardMember',
        columns: [
          col('boardId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('joinedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'BoardMember_role_check_35f881c2',
            "\"role\" IN ('ADMIN', 'NORMAL', 'OBSERVER')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Card',
        columns: [
          col('coverImageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('dueDate', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('dueDateReminder', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isArchived', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('isDueComplete', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('listId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('startDate', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'CardLabel',
        columns: [
          col('cardId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('labelId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'CardMember',
        columns: [
          col('cardId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'CardVote',
        columns: [
          col('cardId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Checklist',
        columns: [
          col('cardId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ChecklistItem',
        columns: [
          col('assignedUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('checklistId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('dueDate', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isCompleted', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('position', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Comment',
        columns: [
          col('cardId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'CommentMention',
        columns: [
          col('commentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('mentionedUserId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'CustomField',
        columns: [
          col('boardId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'CustomField_type_check_a9f06d27',
            "\"type\" IN ('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'CHECKBOX')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'CustomFieldValue',
        columns: [
          col('cardId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('customFieldId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('value', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Label',
        columns: [
          col('boardId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('color', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'List',
        columns: [
          col('boardId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isArchived', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'User',
        columns: [
          col('avatarUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fullName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('username', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Workspace',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('visibility', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Workspace_visibility_check_60a8f38d',
            "\"visibility\" IN ('PUBLIC', 'PRIVATE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'WorkspaceMember',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('joinedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('role', 'text', {
            notNull: true,
            default: lit('MEMBER'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('workspaceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('WorkspaceMember_role_check_ddb31015', "\"role\" IN ('ADMIN', 'MEMBER')"),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'BoardMember',
        constraint: 'BoardMember_boardId_userId_key',
        columns: ['boardId', 'userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'CardLabel',
        constraint: 'CardLabel_cardId_labelId_key',
        columns: ['cardId', 'labelId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'CardMember',
        constraint: 'CardMember_cardId_userId_key',
        columns: ['cardId', 'userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'CardVote',
        constraint: 'CardVote_cardId_userId_key',
        columns: ['cardId', 'userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_username_key',
        columns: ['username'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'WorkspaceMember',
        constraint: 'WorkspaceMember_workspaceId_userId_key',
        columns: ['workspaceId', 'userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Activity',
        index: 'Activity_boardId_idx_74a7b59d',
        columns: ['boardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Activity',
        index: 'Activity_cardId_idx_c511c1e1',
        columns: ['cardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Activity',
        index: 'Activity_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_cardId_idx_c511c1e1',
        columns: ['cardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Board',
        index: 'Board_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BoardMember',
        index: 'BoardMember_boardId_idx_74a7b59d',
        columns: ['boardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BoardMember',
        index: 'BoardMember_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Card',
        index: 'Card_listId_idx_0033d367',
        columns: ['listId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CardLabel',
        index: 'CardLabel_cardId_idx_c511c1e1',
        columns: ['cardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CardLabel',
        index: 'CardLabel_labelId_idx_e2585939',
        columns: ['labelId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CardMember',
        index: 'CardMember_cardId_idx_c511c1e1',
        columns: ['cardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CardMember',
        index: 'CardMember_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CardVote',
        index: 'CardVote_cardId_idx_c511c1e1',
        columns: ['cardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CardVote',
        index: 'CardVote_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Checklist',
        index: 'Checklist_cardId_idx_c511c1e1',
        columns: ['cardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChecklistItem',
        index: 'ChecklistItem_assignedUserId_idx_d0c6c9aa',
        columns: ['assignedUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChecklistItem',
        index: 'ChecklistItem_checklistId_idx_2aea5937',
        columns: ['checklistId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Comment',
        index: 'Comment_cardId_idx_c511c1e1',
        columns: ['cardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Comment',
        index: 'Comment_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CommentMention',
        index: 'CommentMention_commentId_idx_b5a4f615',
        columns: ['commentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CommentMention',
        index: 'CommentMention_mentionedUserId_idx_bd7140cf',
        columns: ['mentionedUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CustomField',
        index: 'CustomField_boardId_idx_74a7b59d',
        columns: ['boardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CustomFieldValue',
        index: 'CustomFieldValue_cardId_idx_c511c1e1',
        columns: ['cardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'CustomFieldValue',
        index: 'CustomFieldValue_customFieldId_idx_e24f3230',
        columns: ['customFieldId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Label',
        index: 'Label_boardId_idx_74a7b59d',
        columns: ['boardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'List',
        index: 'List_boardId_idx_74a7b59d',
        columns: ['boardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WorkspaceMember',
        index: 'WorkspaceMember_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WorkspaceMember',
        index: 'WorkspaceMember_workspaceId_idx_ba65f874',
        columns: ['workspaceId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Activity',
        foreignKey: {
          name: 'Activity_boardId_fkey',
          columns: ['boardId'],
          references: { schema: 'public', table: 'Board', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Activity',
        foreignKey: {
          name: 'Activity_cardId_fkey',
          columns: ['cardId'],
          references: { schema: 'public', table: 'Card', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Activity',
        foreignKey: {
          name: 'Activity_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Attachment',
        foreignKey: {
          name: 'Attachment_cardId_fkey',
          columns: ['cardId'],
          references: { schema: 'public', table: 'Card', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Attachment',
        foreignKey: {
          name: 'Attachment_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Board',
        foreignKey: {
          name: 'Board_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'Workspace', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BoardMember',
        foreignKey: {
          name: 'BoardMember_boardId_fkey',
          columns: ['boardId'],
          references: { schema: 'public', table: 'Board', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BoardMember',
        foreignKey: {
          name: 'BoardMember_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Card',
        foreignKey: {
          name: 'Card_listId_fkey',
          columns: ['listId'],
          references: { schema: 'public', table: 'List', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CardLabel',
        foreignKey: {
          name: 'CardLabel_cardId_fkey',
          columns: ['cardId'],
          references: { schema: 'public', table: 'Card', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CardLabel',
        foreignKey: {
          name: 'CardLabel_labelId_fkey',
          columns: ['labelId'],
          references: { schema: 'public', table: 'Label', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CardMember',
        foreignKey: {
          name: 'CardMember_cardId_fkey',
          columns: ['cardId'],
          references: { schema: 'public', table: 'Card', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CardMember',
        foreignKey: {
          name: 'CardMember_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CardVote',
        foreignKey: {
          name: 'CardVote_cardId_fkey',
          columns: ['cardId'],
          references: { schema: 'public', table: 'Card', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CardVote',
        foreignKey: {
          name: 'CardVote_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Checklist',
        foreignKey: {
          name: 'Checklist_cardId_fkey',
          columns: ['cardId'],
          references: { schema: 'public', table: 'Card', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ChecklistItem',
        foreignKey: {
          name: 'ChecklistItem_checklistId_fkey',
          columns: ['checklistId'],
          references: { schema: 'public', table: 'Checklist', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ChecklistItem',
        foreignKey: {
          name: 'ChecklistItem_assignedUserId_fkey',
          columns: ['assignedUserId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Comment',
        foreignKey: {
          name: 'Comment_cardId_fkey',
          columns: ['cardId'],
          references: { schema: 'public', table: 'Card', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Comment',
        foreignKey: {
          name: 'Comment_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CommentMention',
        foreignKey: {
          name: 'CommentMention_commentId_fkey',
          columns: ['commentId'],
          references: { schema: 'public', table: 'Comment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CommentMention',
        foreignKey: {
          name: 'CommentMention_mentionedUserId_fkey',
          columns: ['mentionedUserId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CustomField',
        foreignKey: {
          name: 'CustomField_boardId_fkey',
          columns: ['boardId'],
          references: { schema: 'public', table: 'Board', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CustomFieldValue',
        foreignKey: {
          name: 'CustomFieldValue_customFieldId_fkey',
          columns: ['customFieldId'],
          references: { schema: 'public', table: 'CustomField', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'CustomFieldValue',
        foreignKey: {
          name: 'CustomFieldValue_cardId_fkey',
          columns: ['cardId'],
          references: { schema: 'public', table: 'Card', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Label',
        foreignKey: {
          name: 'Label_boardId_fkey',
          columns: ['boardId'],
          references: { schema: 'public', table: 'Board', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'List',
        foreignKey: {
          name: 'List_boardId_fkey',
          columns: ['boardId'],
          references: { schema: 'public', table: 'Board', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'WorkspaceMember',
        foreignKey: {
          name: 'WorkspaceMember_workspaceId_fkey',
          columns: ['workspaceId'],
          references: { schema: 'public', table: 'Workspace', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'WorkspaceMember',
        foreignKey: {
          name: 'WorkspaceMember_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
