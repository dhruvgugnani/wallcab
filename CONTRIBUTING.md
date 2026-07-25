# Contributing to WallCab

Thank you for helping make WallCab more useful and dependable. For a new provider, category, composition, or architectural change, begin with an issue so source quality, operational cost, and fallback behavior can be discussed before implementation.

## Development

Use Node.js 24.x and npm.

```powershell
npm.cmd install
npm.cmd run check
npm.cmd run test:e2e
```

Keep pull requests focused and commits coherent. Do not include local `.env` files, Wrangler state, Playwright output, or outer agent configuration.

## Content and asset bar

Lessons need a credible source, bounded text, accessible language, and no duplicate concept in the category. Quotes need reviewed attribution. Photography must be verifiably CC0 or public domain and retain its original credit. A new composition must pass all three device sizes and the 2.2 MiB ceiling.

## Code bar

- keep Server Components as the default;
- validate every external value and query at its trust boundary;
- preserve generation when providers or the Worker fail;
- add tests for behavior and failure modes;
- update API or architecture documentation when an interface changes;
- increment the renderer version when output compatibility changes.

By contributing, you agree that your code contribution is licensed under MIT and that third-party assets retain their stated licenses.
