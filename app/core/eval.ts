import {
  Exp,
  Let,
  Match,
  App,
  Sym,
  Var,
  getMeta,
  initMeta,
  Binary,
  isBinary,
  reduceExp
} from "./exp";
import { identity, pipe } from "fp-ts/function";
import { match, P } from "ts-pattern";
import { lookup } from "fp-ts/Record";
import { getOrElse } from "fp-ts/Option";

export type Binds = Record<string, Exp>;

export const evaluate = (binds: Binds, exp: Exp): Exp =>
  isData(exp) ? exp : evaluate(binds, step(binds, exp));

export const step = (binds: Binds, exp: Exp): Exp =>
  match(exp)
    .with({ type: "let" }, stepLet(binds))
    .with({ type: "match" }, stepMatch(binds))
    .with({ type: "app" }, stepApp(binds))
    .with({ type: "cons" }, cons => ({
      ...cons,
      l: step(binds, cons.l),
      r: step(binds, cons.r),
    }))
    .with({ type: "var" }, resolve(binds))
    .otherwise(identity);

const stepLet = (binds: Binds) => (le: Let): Exp =>
  match(le.l)
    .with({ type: "let" }, stepLetLet(le))
    .with({ type: "match" }, { type: "app" }, stepLetBinary(le))
    .with({ type: "cons" }, { type: "fun" }, stepLetBinaryData(binds, le))
    .with({ type: "null" }, () => stepLetNull(binds, le))
    .with({ type: "sym" }, stepLetSym(binds, le))
    .with({ type: "var" }, stepLetVar(binds, le))
    .exhaustive();

const stepLetLet = (le: Let) => (l: Let): Exp =>
  match(le.m)
    .with({ type: "let" }, unfoldLetLet(le, l))
    .otherwise(() => ({
      type: "null",
      ...getMeta(le),
    }));

const stepLetBinaryData = (binds: Binds, le: Let) => (l: Binary): Exp =>
  match(le.m)
    .with({ type: "let" }, { type: "match" }, { type: "app" }, { type: "var" }, m => ({
      ...le,
      m: step(binds, m),
    }))
    .otherwise(() => stepLetBinary(le)(l));

const stepLetBinary = (le: Let) => (l: Binary): Exp =>
  l.type === le.m.type && isBinary(le.m)
    ? unfoldBinaryLet(le, l)(le.m)
    : {
      type: "null",
      ...getMeta(le),
    };

const unfoldLetLet = (le: Let, l: Let) => (m: Let): Let => ({
  ...le,
  l: { ...l.l, ...getMeta(le.l) },
  m: { ...m.l, ...getMeta(le.m) },
  r: <Let>{
    type: "let",
    l: l.m,
    m: m.m,
    r: <Let>{
      type: "let",
      l: l.r,
      m: m.r,
      r: le.r,
      ...initMeta,
    },
    ...getMeta(le.r),
  },
});

const unfoldBinaryLet = (le: Let, l: Binary) => (m: Binary): Let => ({
  ...le,
  l: { ...l.l, ...getMeta(le.l) },
  m: { ...m.l, ...getMeta(le.m) },
  r: <Let>{
    type: "let",
    l: l.r,
    m: m.r,
    r: le.r,
    ...getMeta(le.r),
  }
});

const stepLetNull = (binds: Binds, le: Let): Exp =>
  match(le.m)
    .with({ type: "let" }, { type: "match" }, { type: "app" }, { type: "var" }, m => ({
      ...le,
      m: step(binds, m),
    }))
    .with({ type: "null" }, () => ({
      ...le.r,
      ...getMeta(le),
    }))
    .otherwise(() => ({
      type: "null",
      ...getMeta(le),
    }));

const stepLetSym = (binds: Binds, le: Let) => (sym: Sym): Exp =>
  match(le.m)
    .with({ type: "let" }, { type: "match" }, { type: "app" }, { type: "var" }, m => ({
      ...le,
      m: step(binds, m),
    }))
    .with({ type: "sym", s: sym.s }, () => ({
      ...le.r,
      ...getMeta(le),
    }))
    .otherwise(() => ({
      type: "null",
      ...getMeta(le),
    }));

const stepLetVar = (binds: Binds, le: Let) => (va: Var): Exp =>
  match(le.r)
    .with({ type: "let" }, { type: "var" }, r => ({
      ...le,
      r: step(bind(va.s, le.m, binds), r),
    }))
    .with({ type: "match" }, { type: "app" }, { type: "cons" }, r => ({
      ...r,
      l: { ...le, r: r.l, ...getMeta(r.l) },
      r: { ...le, r: r.r, ...getMeta(r.r) },
      ...getMeta(le),
    }))
    .with({ type: "fun", l: P.when(l => !mentions(l, va.s)) }, fun => ({
      ...fun,
      r: { ...le, r: fun.r, ...getMeta(fun) },
      ...getMeta(le),
    }))
    .otherwise(r => ({
      ...r,
      ...getMeta(le),
    }));

const stepMatch = (binds: Binds) => (ma: Match): Exp =>
  match(ma.l)
    .with({ type: "let" }, { type: "match" }, { type: "app" }, { type: "var" }, l => ({
      ...ma,
      l: step(binds, l),
    }))
    .with({ type: "null" }, () => ({
      ...ma.r,
      ...getMeta(ma),
    }))
    .otherwise(l => ({
      ...l,
      ...getMeta(ma),
    }));

const stepApp = (binds: Binds) => (app: App): Exp =>
  match(app.l)
    .with({ type: "let" }, { type: "app" }, { type: "var" }, l => ({
      ...app,
      l: step(binds, l),
    }))
    .with({ type: "fun" }, fun => <Let>({
      type: "let",
      l: fun.l,
      m: app.r,
      r: fun.r,
      ...getMeta(app),
    }))
    .with({ type: "match" }, m => ({
      ...m,
      l: { ...app, l: m.l, ...getMeta(m.l) },
      r: { ...app, l: m.r, ...getMeta(m.r) },
      ...getMeta(app),
    }))
    .otherwise(() => ({
      type: "null",
      ...getMeta(app),
    }));

const bind = (k: string, exp: Exp, binds: Binds): Binds =>
  ({ ...binds, [k]: exp });

const resolve = (binds: Binds) => (va: Var): Exp =>
  pipe(
    lookup(va.s)(binds),
    getOrElse(() => <Exp>({ type: "null", ...getMeta(va) })),
  );

const mentions = (exp: Exp, s: string): boolean =>
  pipe(
    exp,
    reduceExp(false, (yes, exp) =>
      yes ||
      match(exp)
        .with({ type: "var" }, va => va.s === s)
        .otherwise(() => false)
    ),
  );

export const isData = (exp: Exp): boolean =>
  match(exp)
    .with({ type: "fun" }, { type: "sym" }, { type: "null" }, () => true)
    .with({ type: "cons" }, cons => isData(cons.l) && isData(cons.r))
    .otherwise(() => false);
