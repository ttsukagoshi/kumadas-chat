import eslintConfigPrettier from 'eslint-config-prettier/flat';
import global from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  eslintConfigPrettier,
  tseslint.configs.recommended,
  {
    files: ['**/*.js', '**/*.ts'],
    languageOptions: {
      ecmaVersion: 2019,
      sourceType: 'module',
      globals: {
        ...global.node,
        ...global.jest,
        DriveApp: false,
        FormApp: false,
        GmailApp: false,
        MailApp: false,
        MimeType: false,
        PropertiesService: false,
        ScriptApp: false,
        Session: false,
        SpreadsheetApp: false,
        UrlFetchApp: false,
        Utilities: false,
      },
    },
  },
);