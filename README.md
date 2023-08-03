# [letscape.willmcpherson2.com](http://letscape.willmcpherson2.com)

## Install

### Environment variables (and defaults)

```sh
PORT=3000
LETSCAPE_DB=/tmp/db.json 
```

### Development build

```sh
npm install
npm run dev
```

### Production build

```sh
rm -rf result
nix-build
npm start --prefix result/letscape
```
