# MathJax runtime

Pinned npm packages: `mathjax@4.1.0`, `@mathjax/mathjax-newcm-font@4.1.0`,
`@mathjax/mathjax-mhchem-font-extension@4.1.0`.

The CHTML component, runtime modules, accessibility assets and CHTML font files
are copied verbatim by `tools/vendor-mathjax.cjs`. Source/TypeScript examples,
Node module builds, alternate entry bundles and SVG font data are omitted.
`4.1.0/manifest.json` records every distributed file's size and SHA-256 hash.
Git attributes preserve the original package bytes across platforms.

All three packages declare Apache-2.0. The upstream license is retained at
`4.1.0/mathjax/LICENSE`; package metadata and bundled copyright headers are
preserved. Upstream: https://github.com/mathjax/MathJax.

Hexo copies this directory as static assets via `skip_render`.
