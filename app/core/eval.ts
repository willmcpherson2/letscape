import {
  Exp,
  Let,
  Match,
  App,
  getMeta,
  reduceExp,
  Null,
  Data,
  Binary,
  onSubExps,
} from "./exp";
import { identity, pipe } from "fp-ts/function";
import { P, match } from "ts-pattern";

export const evaluate = (exp: Exp): Data =>
  match(exp)
    .with({ type: "let" }, evalLet)
    .with({ type: "match" }, evalMatch)
    .with({ type: "app" }, evalApp)
    .with({ type: "var" }, va => <Null>({
      type: "null",
      ...getMeta(va),
    }))
    .otherwise(identity);

const evalLet = (le: Let): Data =>
  match(evaluate(le.l))
    .with({ type: "match" }, ma =>
      match(evaluate(le.m))
        .with({ type: "match" }, m =>
          evaluate(unfold(le, ma, m))
        )
        .otherwise(() => <Null>({
          type: "null",
          ...getMeta(le),
        }))
    )
    .with({ type: "fun" }, fun =>
      match(evaluate(le.m))
        .with({ type: "fun" }, f =>
          evaluate(unfold(le, fun, f))
        )
        .otherwise(() => <Null>({
          type: "null",
          ...getMeta(le),
        }))
    )
    .with({ type: "cons" }, cons =>
      match(evaluate(le.m))
        .with({ type: "cons" }, c =>
          evaluate(unfold(le, cons, c))
        )
        .otherwise(() => <Null>({
          type: "null",
          ...getMeta(le),
        }))
    )
    .with({ type: "bind" }, bind => ({
      ...pipe(le.r, substitute(bind.s, le.m), evaluate),
      ...getMeta(le),
    }))
    .with({ type: "sym" }, sym =>
      match(evaluate(le.m))
        .with({ type: "sym", s: sym.s }, () => ({
          ...evaluate(le.r),
          ...getMeta(le),
        }))
        .otherwise(() => <Null>({
          type: "null",
          ...getMeta(le),
        }))
    )
    .with({ type: "null" }, () =>
      match(evaluate(le.m))
        .with({ type: "null" }, () => evaluate(le.r))
        .otherwise(() => <Null>({
          type: "null",
          ...getMeta(le),
        }))
    )
    .exhaustive();

const unfold = (le: Let, l: Binary, m: Binary): Let => ({
  type: "let",
  l: l.l,
  m: m.l,
  r: {
    type: "let",
    l: l.r,
    m: m.r,
    r: le.r,
  },
  ...getMeta(le),
});

const evalMatch = (ma: Match): Data =>
  match(evaluate(ma.l))
    .with({ type: "fun" }, l => ({
      ...ma,
      l,
    }))
    .with({ type: "null" }, () =>
      evaluate({
        ...ma.r,
        ...getMeta(ma),
      })
    )
    .otherwise(l => ({
      ...l,
      ...getMeta(ma),
    }));

const evalApp = (app: App): Data =>
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

const substitute = (s: string, m: Exp) => (r: Exp): Exp =>
  match(r)
    .with({ type: "let" }, le =>
      binds(le.l, s)
        ? le
        : pipe(le, onSubExps(substitute(s, m)))
    )
    .with({ type: "fun" }, fun =>
      binds(fun.l, s)
        ? fun
        : pipe(fun, onSubExps(substitute(s, m)))
    )
    .with({ l: P._ }, onSubExps(substitute(s, m)))
    .with({ type: "var" }, va =>
      va.s === s
        ? <Let>{
          type: "let",
          l: { type: "bind", s },
          m,
          r: m,
          ...getMeta(va),
        }
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
