import {
  Exp,
  Let,
  Match,
  App,
  getMeta,
  reduceExp,
  Binary,
  onSubExps,
  isCode,
} from "./exp";
import { identity, pipe } from "fp-ts/function";
import { P, match } from "ts-pattern";
import { currentTime, edit } from "./history";

export type Rewrite = (exp: Exp, change: Exp) => Exp;

export const evalRewrite: Rewrite = (exp, change) =>
  ({ ...change, ...getMeta(exp) });

export const stepRewrite: Rewrite = (exp, change) =>
  edit(currentTime(exp), evalRewrite(exp, change))(exp);

export const evalDeep = (f: Rewrite) => (exp: Exp): Exp =>
  match(evaluate(f)(exp))
    .with({ type: "cons" }, cons => ({
      ...cons,
      l: evalDeep(f)(cons.l),
      r: evalDeep(f)(cons.r),
    }))
    .otherwise(identity);

export const needsEval = (exp: Exp): boolean =>
  match(exp)
    .with({ type: "cons" }, cons => isCode(cons.l) || isCode(cons.r))
    .otherwise(isCode);

export const evaluate = (f: Rewrite) => (exp: Exp): Exp =>
  match(exp)
    .with({ type: "let" }, evalLet(f))
    .with({ type: "match" }, evalMatch(f))
    .with({ type: "app" }, evalApp(f))
    .with({ type: "var" }, va => f(va, { type: "null" }))
    .otherwise(identity);

const evalLet = (f: Rewrite) => (le: Let): Exp =>
  match(evaluate(f)(le.l))
    .with({ type: "match" }, l =>
      match(evaluate(f)(le.m))
        .with({ type: "match" }, m =>
          evaluate(f)(unfold(f)(le, l, m))
        )
        .otherwise(m => f({ ...le, l, m }, { type: "null" }))
    )
    .with({ type: "fun" }, l =>
      match(evaluate(f)(le.m))
        .with({ type: "fun" }, m =>
          evaluate(f)(unfold(f)(le, l, m))
        )
        .otherwise(m => f({ ...le, l, m }, { type: "null" }))
    )
    .with({ type: "cons" }, l =>
      match(evaluate(f)(le.m))
        .with({ type: "cons" }, m =>
          evaluate(f)(unfold(f)(le, l, m))
        )
        .otherwise(m => f({ ...le, l, m }, { type: "null" }))
    )
    .with({ type: "bind" }, l =>
      evaluate(f)(f({ ...le, l }, substitute(f)(l.s, le.m)(le.r)))
    )
    .with({ type: "sym" }, l =>
      match(evaluate(f)(le.m))
        .with({ type: "sym", s: l.s }, m =>
          evaluate(f)(f({ ...le, l, m }, le.r))
        )
        .otherwise(m => f({ ...le, l, m }, { type: "null" }))
    )
    .with({ type: "null" }, l =>
      match(evaluate(f)(le.m))
        .with({ type: "null" }, m => evaluate(f)(f({ ...le, l, m }, le.r)))
        .otherwise(m => f({ ...le, l, m }, { type: "null" }))
    )
    .run();

const unfold = (f: Rewrite) => (le: Let, l: Binary, m: Binary): Exp =>
  f(
    le,
    {
      type: "let",
      l: l.l,
      m: m.l,
      r: {
        type: "let",
        l: l.r,
        m: m.r,
        r: le.r,
      },
    }
  );

const evalMatch = (f: Rewrite) => (ma: Match): Exp =>
  match(evaluate(f)(ma.l))
    .with({ type: "fun" }, l => ({ ...ma, l }))
    .with({ type: "null" }, l => evaluate(f)(f({ ...ma, l }, ma.r)))
    .otherwise(l => f({ ...ma, l }, l));

const evalApp = (f: Rewrite) => (app: App): Exp =>
  match(app.l)
    .with({ type: "let" }, { type: "app" }, { type: "var" }, l =>
      evaluate(f)({
        ...app,
        l: evaluate(f)(l),
      })
    )
    .with({ type: "fun" }, fun =>
      evaluate(f)(
        f(
          app,
          {
            type: "let",
            l: fun.l,
            m: app.r,
            r: fun.r,
          },
        )
      )
    )
    .with({ type: "match" }, m =>
      evaluate(f)(
        f(
          app,
          {
            ...m,
            l: { ...app, l: m.l, ...getMeta(m.l) },
            r: { ...app, l: m.r, ...getMeta(m.r) },
          },
        )
      )
    )
    .otherwise(() => f(app, { type: "null" }));

const substitute = (f: Rewrite) => (s: string, m: Exp) => (r: Exp): Exp =>
  match(r)
    .with({ type: "let" }, le =>
      binds(le.l, s)
        ? le
        : pipe(le, onSubExps(substitute(f)(s, m)))
    )
    .with({ type: "fun" }, fun =>
      binds(fun.l, s)
        ? fun
        : pipe(fun, onSubExps(substitute(f)(s, m)))
    )
    .with({ l: P._ }, onSubExps(substitute(f)(s, m)))
    .with({ type: "var" }, va =>
      va.s === s
        ? f(
          va,
          {
            type: "let",
            l: { type: "bind", s },
            m,
            r: m,
          },
        )
        : va
    )
    .otherwise(identity);

const binds = (exp: Exp, s: string): boolean =>
  pipe(
    exp,
    reduceExp(false, (yes, exp) =>
      yes ||
      match(exp)
        .with({ type: "bind" }, bind => bind.s === s)
        .otherwise(() => false)
    ),
  );
