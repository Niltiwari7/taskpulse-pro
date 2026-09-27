import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.prisma/**', '**/migrations/**', '**/*.d.ts', '**/.agents/**', '**/.claude/**', '**/.cursor/**', '**/.devin/**'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  }
)