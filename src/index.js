#!/usr/bin/env node
import { resolve as resolvePath, basename, extname } from 'path';
import Handlebars from 'handlebars';
import minimist from 'minimist';
import glob from 'glob-promise';
import packageJson from '../package.json';
import resolveNode from 'resolve';
import { readFile, writeFile } from 'fs-promise';
import merge from 'lodash.merge';
import mkdirp from 'mkdirp-then';
import getStdin from 'get-stdin';
const debug = require('debug')('hbs');
function resolve(file, options) {
  return new Promise((resolvePromise, reject) => resolveNode(file, options, (errorLocal, path) => {
    if (errorLocal) {
      reject(errorLocal);
    } else {
      resolvePromise(path);
    }
  }));
}
export async function resolveModuleOrGlob(path, cwd = process.cwd()) {
  try {
    debug(`Trying to require ${ path } as a node_module`);
    return [ await resolve(path, { basedir: cwd }) ];
  } catch (errorInCatch) {
    debug(`${ path } is glob or actual file, expanding...`);
    return await glob(path, { cwd });
  }
}

export async function expandGlobList(globs) {
  if (typeof globs === 'string') {
    globs = [ globs ];
  }
  if (Array.isArray(globs) === false) {
    throw new Error(`expandGlobList expects Array or String, given ${ typeof globs }`);
  }
  return (await Promise.all(
    globs.map((path) => resolveModuleOrGlob(path))
  )).reduce((total, current) => total.concat(current), []);
}

export function addHandlebarsHelpers(files) {
  files.forEach((file) => {
    debug(`Requiring ${ file }`);
    const handlebarsHelper = require(file); // eslint-disable-line global-require
    if (handlebarsHelper && typeof handlebarsHelper.register === 'function') {
      debug(`${ file } has a register function, registering with handlebars`);
      handlebarsHelper.register(Handlebars);
    } else {
      console.error(`WARNING: ${ file } does not export a 'register' function, cannot import`);
    }
  });
}

export async function addHandlebarsPartials(files) {
  await Promise.all(files.map(async (file) => {
    debug(`Registering partial ${ file }`);
    Handlebars.registerPartial(basename(file, extname(file)), await readFile(file, 'utf8'));
  }));
}

export async function addObjectsToData(objects) {
  if (typeof objects === 'string') {
    objects = [ objects ];
  }
  if (Array.isArray(objects) === false) {
    throw new Error(`addObjectsToData expects Array or String, given ${ typeof objects }`);
  }
  const dataSets = [];
  const files = await expandGlobList(objects.filter((objectLocal) => {
    try {
      debug(`Attempting to parse ${ objectLocal } as JSON`);
      dataSets.push(JSON.parse(objectLocal));
      return false;
    } catch (errorInCatch) {
      return true;
    }
  }));
  const fileContents = await Promise.all(
    files.map(async (file) => {
      debug(`Loading JSON file ${ file }`);
      return JSON.parse(await readFile(file, 'utf8'));
    })
  );
  return merge({}, ...dataSets.concat(fileContents));
}

export async function getStdinData() {
  const text = await getStdin();
  try {
    debug(`Attempting to parse ${ text } as JSON`);
    return JSON.parse(text);
  } catch (errorInCatch) {
    throw new Error('stdin cannot be parsed as JSON');
  }
}

export async function renderHandlebarsTemplate(
  files, outputDirectory = process.cwd(),
  outputExtension = 'html', dataLocal = {}, stdout = false) {
  await Promise.all(files.map(async (file) => {
    debug(`Rendering template ${ file } with data`, dataLocal);
    const path = resolvePath(outputDirectory, `${ basename(file, extname(file)) }.${ outputExtension }`);
    const htmlContents = Handlebars.compile(await readFile(file, 'utf8'))(dataLocal);
    if (stdout) {
      await process.stdout.write(htmlContents, 'utf8');
    } else {
      await mkdirp(outputDirectory);
      await writeFile(path, htmlContents, 'utf8');
      debug(`Wrote ${ path }`);
      console.error(`Wrote ${ path } from ${ file }`);
    }
  }));
}

if (require.main === module) {
  const options = minimist(process.argv.slice(2), {
    /* eslint-disable id-blacklist */
    string: [
      'output',
      'extension',
      'partial',
      'helper',
      'data',
    ],
    boolean: [
      'version',
      'help',
      'stdout',
      'stdin',
    ],
    alias: {
      'v': 'version',
      'h': 'help',
      'o': 'output',
      'e': 'extension',
      's': 'stdout',
      'i': 'stdin',
      'D': 'data',
      'P': 'partial',
      'H': 'helper',
    },
  });
  debug('Parsed argv', options);
  if (options.version) {
    console.error(packageJson.version);
  } else if (options.help || !options._ || !options._.length) {
    console.error(`
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
    `);
  } else {
    const setup = [];
    let dataLocal = {};
    if (options.helper) {
      debug('Setting up helpers', options.helper);
      setup.push(expandGlobList(options.helper).then(addHandlebarsHelpers));
    }
    if (options.partial) {
      debug('Setting up partials', options.partial);
      setup.push(expandGlobList(options.partial).then(addHandlebarsPartials));
    }
    if (options.data) {
      debug('Setting up data', options.data);
      setup.push(addObjectsToData(options.data).then((result) => {
        dataLocal = result;
      }));
    }
    if (options.stdin) {
      debug('Setting up stdin', options.stdin);
      setup.push(getStdinData().then((stdinData) => {
        dataLocal = stdinData;
      }));
    }
    Promise.all(setup)
      .then(() => expandGlobList(options._))
      .then((files) => renderHandlebarsTemplate(files, options.output, options.extension, dataLocal, options.stdout))
      .catch((errorLocal) => {
        console.error(errorLocal.stack || errorLocal);
        process.exit(1);
      });
  }
}
