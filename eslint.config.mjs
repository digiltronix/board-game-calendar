import withNuxt from './.nuxt/eslint.config.mjs'
import prettierConfig from 'eslint-config-prettier'

export default withNuxt(
  // functions/lib is compiled output (git-ignored, but present locally after
  // `yarn workspace functions run build`)
  { ignores: ['functions/lib/**'] },
  prettierConfig,
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
)
