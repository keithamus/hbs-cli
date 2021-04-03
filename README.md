# hbs-cli

This is a tool to render [handlebars](http://handlebarsjs.com) templates, with the ability to require in Partials, Helpers and JSON Data.

## Installation

```sh
$ npm install --save-dev hbs-cli
```

## Usage

```sh
Usage:
  hbs --version
  hbs --help
  hbs [-P <partial>]... [-H <helper>]... [-D <data>]... [-o <directory>] [--] (<template...>)

  -h, --help                 output usage information
  -v, --version              output the version number
  -o, --output <directory>   Directory to output rendered templates, defaults to cwd
  -e, --extension            Output extension of generated files, defaults to html
  -s, --stdout               Output to standard output
  -i, --stdin                Receive data directly from stdin
  -P, --partial <glob>...    Register a partial (use as many of these as you want)
  -H, --helper <glob>...     Register a helper (use as many of these as you want)

  -D, --data <glob|json>...  Parse some data

Examples:

hbs --helper handlebars-layouts --partial ./templates/layout.hbs -- ./index.hbs
hbs --data ./package.json --data ./extra.json ./homepage.hbs --output ./site/
hbs --helper ./helpers/* --partial ./partials/* ./index.hbs # Supports globs!
```

_* Yarn and NPM expand globs, so if you're using this in an NPM script make sure you wrap globs in quotes. For example:_
```sh
hbs index.hbs --partial 'partials/*.hbs'
```

## Using Helpers

In order to use Handlebar helpers you can simply create a folder with all your helpers in a js file each. These modules must export a register function which gets the Handlebars instance passed through its first parameter.

```js
// src/template_helper/times.js
var times = function () {};

times.register = function (Handlebars) {
    Handlebars.registerHelper('times', function(n, block) {
        var accum = '';
        for(var i = 0; i < n; ++i)
            accum += block.fn(i);
        return accum;
    });
};

module.exports = times;
```

Now you are able to use the `times` function within your Handlebars template such as this:

```
{{#times 10}}
  <span>{{this}}</span>
{{/times}}
```

To compile this template you may run this command:

```bash
hbs --helper ./src/template_helper/**/*.js --data src/data.json src/templates/**/*.hbs --output dist/
```
