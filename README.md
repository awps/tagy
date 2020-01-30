## tagy 

A easy way to create a release by tagging it in git directly from local repo using the terminal. 
Create a new git tag by following the 'Semantic Versioning' and push it on remote. 
 > Note: This will also bump the version in `package.json` before pushing it on remote origin.

[![NPM](https://nodei.co/npm/tagy.png?compact=true)](https://nodei.co/npm/tagy/)

#### Install globally:
```
npm i tagy -g
```

#### Use it in terminal from working directory:
```
tagy [-p, -m, --minor, --patch, --major, --reverse, --info]
```

##### Arguments
```sh 
-p, --patch  # Will increase the version like so: 1.0.0 => 1.0.1
-m, --minor  # Will increase the version like so: 1.0.0 => 1.1.0
--major      # Will increase the version like so: 1.0.0 => 2.0.0
--reverse    # Will remove the last tag and revert to previously created one.
--info       # Get some info about current project.
```

## Extend the 

#### Custom scripts before `git push` is executed.
Create a file in your project directory named `tagy.js` and inside export a module function with some logic. This function will be executed just before the `git push` command is called.
Doing so you have the option to manipulate the files before they are released. 
For example: 
```js 
module.exports = (newVersion, oldVersion, args) => {
    console.log('Custom "tagy" scripts can be used before git push');
}
```
