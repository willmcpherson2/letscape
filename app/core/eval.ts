import {
  Exp,
  Let,
  Match,
  App,
  Sym,
  getMeta,
  Binary,
  isBinary,
  reduceExp,
  Null,
} from "./exp";
import { identity, pipe } from "fp-ts/function";
import { P, match } from "ts-pattern";

export const evaluate = (exp: Exp): Exp =>
  match(exp)
    .with({ type: "let" }, evalLet)
    .with({ type: "match" }, evalMatch)
    .with({ type: "app" }, evalApp)
    .with({ type: "var" }, va => <Null>({
      type: "null",
      ...getMeta(va),
    }))
    .otherwise(identity);

const evalLet = (le: Let): Exp =>
  match(le.l)
    .with({ type: "let" }, evalLetLet(le))
    .with({ type: "match" }, { type: "app" }, evalLetBinary(le))
    .with({ type: "cons" }, { type: "fun" }, evalLetBinaryData(le))
    .with({ type: "null" }, () => evalLetNull(le))
    .with({ type: "sym" }, evalLetSym(le))
    .with({ type: "var" }, va =>
      evaluate({
        ...substitute(va.s, le.m, le.r),
        ...getMeta(le),
      })
    )
    .exhaustive();

const evalLetLet = (le: Let) => (l: Let): Exp =>
  match(le.m)
    .with({ type: "let" }, unfoldLetLet(le, l))
    .otherwise(() => ({
      type: "null",
      ...getMeta(le),
    }));

const evalLetBinaryData = (le: Let) => (l: Binary): Exp =>
  match(le.m)
    .with({ type: "let" }, { type: "match" }, { type: "app" }, { type: "var" }, m =>
      evaluate({
        ...le,
        m: evaluate(m),
      })
    )
    .otherwise(() => evalLetBinary(le)(l));

const evalLetBinary = (le: Let) => (l: Binary): Exp =>
  l.type === le.m.type && isBinary(le.m)
    ? unfoldBinaryLet(le, l)(le.m)
    : {
      type: "null",
      ...getMeta(le),
    };

const unfoldLetLet = (le: Let, l: Let) => (m: Let): Exp =>
  evaluate({
    ...le,
    l: { ...l.l, ...getMeta(le.l) },
    m: { ...m.l, ...getMeta(le.m) },
    r: {
      type: "let",
      l: l.m,
      m: m.m,
      r: {
        type: "let",
        l: l.r,
        m: m.r,
        r: le.r,
      },
      ...getMeta(le.r),
    },
  });

const unfoldBinaryLet = (le: Let, l: Binary) => (m: Binary): Exp =>
  evaluate({
    ...le,
    l: { ...l.l, ...getMeta(le.l) },
    m: { ...m.l, ...getMeta(le.m) },
    r: {
      type: "let",
      l: l.r,
      m: m.r,
      r: le.r,
      ...getMeta(le.r),
    }
  });

const evalLetNull = (le: Let): Exp =>
  match(le.m)
    .with({ type: "let" }, { type: "match" }, { type: "app" }, { type: "var" }, m =>
      evaluate({
        ...le,
        m: evaluate(m),
      })
    )
    .with({ type: "null" }, () =>
      evaluate({
        ...le.r,
        ...getMeta(le),
      })
    )
    .otherwise(() => ({
      type: "null",
      ...getMeta(le),
    }));

const evalLetSym = (le: Let) => (sym: Sym): Exp =>
  match(le.m)
    .with({ type: "let" }, { type: "match" }, { type: "app" }, { type: "var" }, m =>
      evaluate({
        ...le,
        m: evaluate(m),
      })
    )
    .with({ type: "sym", s: sym.s }, () =>
      evaluate({
        ...le.r,
        ...getMeta(le),
      })
    )
    .otherwise(() => ({
      type: "null",
      ...getMeta(le),
    }));

const evalMatch = (ma: Match): Exp =>
  match(ma.l)
    .with({ type: "let" }, { type: "match" }, { type: "app" }, { type: "var" }, l =>
      evaluate({
        ...ma,
        l: evaluate(l),
      })
    )
    .with({ type: "fun" }, () => ma)
    .with({ type: "null" }, () =>
      evaluate({
        ...ma.r,
        ...getMeta(ma),
      })
    )
    .otherwise(l =>
      evaluate({
        ...l,
        ...getMeta(ma),
      })
    );

const evalApp = (app: App): Exp =>
  match(app.l)
    .with({ type: "let" }, { type: "app" }, { type: "var" }, l =>
      evaluate({
        ...app,
        l: evaluate(l),
      })
    )
    .with({ type: "fun" }, fun =>
      evaluate({
        type: "let",
        l: fun.l,
        m: app.r,
        r: fun.r,
        ...getMeta(app),
      })
    )
    .with({ type: "match" }, m =>
      evaluate({
        ...m,
        l: { ...app, l: m.l, ...getMeta(m.l) },
        r: { ...app, l: m.r, ...getMeta(m.r) },
        ...getMeta(app),
      })
    )
    .otherwise(() => ({
      type: "null",
      ...getMeta(app),
    }));

const substitute = (s: string, m: Exp, r: Exp): Exp =>
  match(r)
    .with({ type: "let" }, le =>
      mentions(le.l, s)
        ? le
        : {
          ...le,
          m: substitute(s, m, le.m),
          r: substitute(s, m, le.r),
        }
    )
    .with({ type: "fun" }, fun =>
      mentions(fun.l, s)
        ? fun
        : {
          ...fun,
          r: substitute(s, m, fun.r),
        }
    )
    .with({ l: P._ }, exp => ({
      ...exp,
      l: substitute(s, m, exp.l),
      r: substitute(s, m, exp.r),
    }))
    .with({ type: "var" }, va =>
      mentions(va, s)
        ? <Let>{
          type: "let",
          l: { type: "var", s },
          m,
          r: m,
          ...getMeta(va),
        }
        : va
    )
    .otherwise(identity);

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
