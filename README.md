## tagy 

An easy way to create Git releases using git tags. 
Create a new git tag by following the 'Semantic Versioning' and push it on remote. 
 > Note: This will also bump the version in `package.json` before pushing it on remote origin.

[![NPM](https://nodei.co/npm/tagy.png?compact=true)](https://nodei.co/npm/tagy/)

#### Install globally:
```
npm i tagy -g
```

#### Use it in terminal from working directory:
```
tagy [-p, -m, --minor, --patch, --major, --reverse, --info, --custom, -h]
```

##### Arguments
```sh 
-p, --patch  # Will increase the version from 1.0.0 to 1.0.1
-m, --minor  # Will increase the version from 1.0.0 to 1.1.0
--major      # Will increase the version from 1.0.0 to 2.0.0
--reverse    # Will remove the last tag and revert to previously created one.
--info       # Get some info about current project.
--custom     # Define the new Semantic version manually.
--soft       # Create a soft tag. This will not commit the changes to git or create a new git tag.
-h           # Show help information.
```

## `package.json` configuration:

_All parameters are optional._

```
"tagy": {
    "tagPrefix": "v",
    "soft": true,
    "replace": [
        {
            "files": "themes/custom/style.css",
            "from": "Version: \\d+\\.\\d+\\.\\d+",
            "to": "Version: __VERSION__",
            "flags": "g"
        }
    ]
}
```

Description of the above parameters:
* `tagPrefix` - (optional) Allows to create releases with a prefix. For example, if you want to create a release with a prefix `v` and the version is `1.0.0`, the tag will be `v1.0.0`. The tag in git will be `v1.0.0`.
* `soft` - (optional) Allows to create a new version which will update only the `package.json` and follow any rules in `tagy.js` file or `package.json`, but will not commit the changes to git or create a new git tag. So basically, it will do only a search and replace in files without affecting the git tags.
* `replace` - (optional) Allows to define custom replacement rules in `package.json` file. For example, if you want to replace the version in a file named `style.css` with the version from `package.json`, add the following in `package.json`: 
  * `files` - (required) The file or files where the replacement will be done. This can be a string or an array of strings. Relative to `package.json` file!
  * `from` - (required) The string or regex to search for. If you define a regex, make sure to escape the special characters and double escape the backslash. 
  * `to` - (required) The string to replace the matched string or regex of `from`. You can use the `__VERSION__` placeholder to use the new version from `package.json`.
  * `flags` - (optional) The flags to use for the regex. Default is `g`.


#### The above `from` and `to` parameters accept 2 types of variables: 
* `__VERSION__` - This will be replaced with the new version from `package.json`.
* `__CURRENT_TAG__` - This will be replaced with the current tag from git.

## Extend it:

#### Custom scripts before `git push` is executed.
Create a file in your project directory named `tagy.js` and inside export a module function with some logic. This function will be executed just before the `git push` command is called.
Doing so you have the option to manipulate the files before they are released. 
For example: 
```js 
module.exports = (newVersion, oldVersion, args) => {
    console.log('Custom "tagy" scripts can be used before git push');
}
```

A real example, replacing the version in a css file.
```
const path = require('path');
const replace = require('replace-in-file');

module.exports = (newVersion, oldVersion, args) => {
    replace.sync({
        files: path.resolve(__dirname, 'src/style.css'),
        from: /Version: \d+\.\d+\.\d+/g,
        to: `Version: ${newVersion}`,
    });
}
```

## New in version 1.8
### Soft tag:

A soft tag will allow to create a new version which will update only the `package.json` and follow any rules in `tagy.js` file, 
but will not commit the changes to git or create a new git tag.

So basically, it will do only a search and replace in files without affecting the git tags.

To enable this, add the following in `package.json`: 
```
"tagy": {
    "method": "soft"
}
```

## New in version 1.9
### Tag Prefix:

This allows to create releases with a prefix.

For example, if you want to create a release with a prefix `v` and the version is `1.0.0`, the tag will be `v1.0.0`.

To enable this, add the following in `package.json`: 
```
"tagy": {
    "tagPrefix": "v"
}
```

## New in version 1.10
### Replacements from `package.json`:

This allows to define custom replacement rules in `package.json` file.

For example, if you want to replace the version in a file named `style.css` with the version from `package.json`, add the following in `package.json`: 
```
"tagy": {
    "replace": [
        {
            "files": "themes/custom/style.css",
            "from": "Version: \\d+\\.\\d+\\.\\d+",
            "to": "Version: __VERSION__",
            "flags": "g"
        }
    ]
}
```

In the above example we replace the version from style.css with the new version from `package.json` file.

**This is an array of objects, so you can define multiple replacements.**

### Other changes in version 1.10 include:
* Added `--soft` argument to create a soft tag directly from terminal.
* Deprecated `{"method": "soft"}` in `package.json` file. Use `{"soft": true}` instead.


## New in version 1.10.1
* Added Github release prompt. This will allow to create a Github release directly from terminal after the tag is created.
