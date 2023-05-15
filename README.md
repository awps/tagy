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
tagy [-p, -m, --minor, --patch, --major, --reverse, --info, --custom]
```

##### Arguments
```sh 
-p, --patch  # Will increase the version from 1.0.0 to 1.0.1
-m, --minor  # Will increase the version from 1.0.0 to 1.1.0
--major      # Will increase the version from 1.0.0 to 2.0.0
--reverse    # Will remove the last tag and revert to previously created one.
--info       # Get some info about current project.
--custom     # Define the new Semantic version manually.
```

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

## Soft tag:
_New in version 1.8_

A soft tag will allow to create a new version which will update only the `package.json` and follow any rules in `tagy.js` file, 
but will not commit the changes to git or create a new git tag.

So basically, it will do only a search and replace in files without affecting the git tags.

To enable this, add the following in `package.json`: 
```
"tagy": {
    "method": "soft"
}
```

