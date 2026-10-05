# @owlcept/engine

The command-risk and explanation engine behind OwlCept. Pure TypeScript, no
dependencies, no network access: the same code runs in the browser extension,
the Windows agent and the web checker.

```ts
import { analyze, explain } from '@owlcept/engine';

const verdict = analyze(clipboardText, { target: 'run', custody });
verdict.action; // 'allow' | 'warn' | 'block'
explain(verdict, custody, 'hi').headline;
```

- `deobfuscate` peels base64, hex, char codes, split strings, `^` and backtick
  escapes, environment-variable slicing and decoy-comment padding.
- `runRules` names what the decoded command would do.
- `score` combines that with where the text came from (the custody record).
  Provenance alone never prompts; a hidden copy next to lure text always blocks.
- `explain` writes the warning in English, Hindi or Kannada.
- `checkOAuthPaste` is the ConsentFix guard for web forms.

`npm test` runs the unit tests; every sample is defanged (`*.test` hosts that
never resolve).
