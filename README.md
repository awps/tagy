## TAGY 

[![NPM](https://nodei.co/npm/tagy.png?compact=true)](https://nodei.co/npm/tagy/)

Create a new git tag by following the 'Semantic Versioning' and push it on remote.

#### Install globally:
```
npm i tagy -g
```

#### Use it in terminal from working directory:
```
tagy [-p, -m, --minor, --patch, --major, --reverse, --info]
```

#### Custom scripts before `git push` is executed.
Create a file in your project directory named `tagy.js` and inside export a module function with some logic. This functions will be executed just before the `git push` command is called.
Doing so you have the option to manipulate the files before they are released. 
For example: 
```js 
module.exports = () => {
    console.log('Custom "tagy" scripts can be used before git push');
}
```
