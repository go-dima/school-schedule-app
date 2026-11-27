import { ESLint } from "eslint";

// ESLint 8 reports an ignored file as a warning, and --max-warnings 0 turns
// that into a failure. So ignored files get prettier only. .eslintrc.json
// (ignorePatterns) is the only ignore list: do not add a second one here.
const quote = paths => paths.map(p => JSON.stringify(p)).join(" ");

export default {
  "*.{ts,tsx}": async files => {
    const eslint = new ESLint();
    const lintable = [];
    for (const file of files) {
      if (!(await eslint.isPathIgnored(file))) lintable.push(file);
    }
    const commands = [`prettier --write ${quote(files)}`];
    if (lintable.length > 0) {
      commands.push(
        `eslint --fix --max-warnings 0 --report-unused-disable-directives ${quote(lintable)}`
      );
    }
    return commands;
  },
  "*.{js,jsx,json,css,md}": "prettier --write",
};
