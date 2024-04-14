# letscape

[letscape.willmcpherson2.com](http://letscape.willmcpherson2.com/)

[Video](https://www.youtube.com/watch?v=GHrnok_Q168)

Letscape is...

- A lazy functional programming language
- A structural editor, with copy/paste and undo/redo
- An interpreter, featuring step-wise evaluation (which you can undo/redo)

## Install

### Environment variables (and defaults)

```sh
PORT=3000
LETSCAPE_DB=./prelude.json
```

### Development build

```sh
npm install
npm run dev
```

### Production build

```sh
nix build
npm start --prefix result/letscape
```
