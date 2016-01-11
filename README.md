# hbs-cli

This is a tool to render [handlebars](http://handlebarsjs.com) templates, with the ability to require in Partials, Helpers and JSON Data.

```sh
Usage:
  hbs --version
  hbs --help
  hbs [-P <partial>]... [-H <helper>]... [-D <data>]... [-o <directory>] [--] (<template...>)

  -h, --help                 output usage information
  -v, --version              output the version number
  -o, --output <directory>   Directory to output rendered templates, defaults to cwd
  -P, --partial <glob>...    Register a partial (use as many of these as you want)
  -H, --helper <glob>...     Register a helper (use as many of these as you want)
  -D, --data <glob|json>...  Parse some data

Examples:

hbs --helper handlebars-layouts --partial ./templates/layout.hbs -- ./index.hbs
hbs --data ./package.json --data ./extra.json ./homepage.hbs --output ./site/
hbs --helpers ./helpers/* --partial ./partials/* ./index.hbs # Supports globs!
```
