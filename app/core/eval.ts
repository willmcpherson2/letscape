import {
  Exp,
  Let,
  Match,
  App,
  getMeta,
  reduceExp,
  Binary,
  isCode,
  Time,
  Bind,
  onSubExps,
} from "./exp";
import { identity, pipe } from "fp-ts/function";
import { P, match } from "ts-pattern";
import { edit } from "./history";

export type Rewrite = (state: State<Exp>, change: Exp) => State<Exp>;

type State<E extends Exp> = {
  rewrite: Rewrite;
  time: Time;
  exp: E;
};

export const evalRewrite: Rewrite = (state, change) => ({
  ...state,
  exp: change,
});

export const stepRewrite: Rewrite = (state, change) => ({
  ...state,
  time: state.time + 1,
  exp: edit(state.time, change)(state.exp),
});

export const needsEval = (exp: Exp): boolean =>
  match(exp)
    .with({ type: "cons" }, cons => isCode(cons.l) || isCode(cons.r))
    .otherwise(isCode);

export const evalDeep = (exp: State<Exp>): State<Exp> =>
  match(evaluate(exp))
    .with({ exp: { type: "cons" } }, cons => {
      const l = evalDeep({ ...cons, exp: cons.exp.l });
      const r = evalDeep({ ...l, exp: cons.exp.r });
      return { ...r, exp: { ...cons.exp, l: l.exp, r: r.exp } };
    })
    .otherwise(identity);

export const evaluate = (exp: State<Exp>): State<Exp> =>
  match(exp)
    .with({ exp: { type: "let" } }, le => evalLet({ ...exp, exp: le.exp }))
    .with({ exp: { type: "match" } }, ma => evalMatch({ ...exp, exp: ma.exp }))
    .with({ exp: { type: "app" } }, app => evalApp({ ...exp, exp: app.exp }))
    .with({ exp: { type: "var" } }, va => exp.rewrite(
      { ...exp, exp: va.exp },
      { type: "null" },
    ))
    .otherwise(identity);

const evalLet = (le: State<Let>): State<Exp> =>
  match(evaluate({ ...le, exp: le.exp.l }))
    .with({ exp: { type: "match" } }, unfold(le))
    .with({ exp: { type: "fun" } }, unfold(le))
    .with({ exp: { type: "cons" } }, unfold(le))
    .with({ exp: { type: "sym" } }, l =>
      match(evaluate({ ...l, exp: le.exp.m }))
        .with({ exp: { type: "sym", s: l.exp.s } }, m => evaluate(m.rewrite(
          { ...m, exp: { ...le.exp, l: l.exp, m: m.exp } },
          le.exp.r,
        )))
        .otherwise(m => m.rewrite(
          { ...m, exp: { ...le.exp, l: l.exp, m: m.exp } },
          { type: "null" },
        ))
    )
    .with({ exp: { type: "null" } }, l =>
      match(evaluate({ ...l, exp: le.exp.m }))
        .with({ exp: { type: "null" } }, m => evaluate(m.rewrite(
          { ...m, exp: { ...le.exp, l: l.exp, m: m.exp } },
          le.exp.r,
        )))
        .otherwise(m => m.rewrite(
          { ...m, exp: { ...le.exp, l: l.exp, m: m.exp } },
          { type: "null" },
        ))
    )
    .with({ exp: { type: "bind" } }, bind => evaluate(bind.rewrite(
      { ...bind, exp: { ...le.exp, l: bind.exp } },
      substitute(bind.exp, le.exp.m)(le.exp.r),
    )))
    .run();

const unfold = <B extends Binary>(le: State<Let>) => (l: State<B>): State<Exp> =>
  match(evaluate({ ...l, exp: le.exp.m }))
    .with({ exp: { type: l.exp.type } }, m => evaluate(m.rewrite(
      { ...m, exp: le.exp },
      {
        type: "let",
        l: l.exp.l,
        m: m.exp.l,
        r: {
          type: "let",
          l: l.exp.r,
          m: m.exp.r,
          r: le.exp.r,
        },
      }
    )))
    .otherwise(m => m.rewrite(
      { ...m, exp: { ...le.exp, l: l.exp, m: m.exp } },
      { type: "null" }
    ));

const substitute = (bind: Bind, def: Exp) => (scope: Exp): Exp =>
  match(scope)
    .with({ type: "let" }, { type: "fun" }, exp =>
      binds(exp.l, bind)
        ? exp
        : onSubExps(substitute(bind, def))(exp)
    )
    .with({ l: P._ }, onSubExps(substitute(bind, def)))
    .with({ type: "var", s: bind.s }, () => <Let>({
      type: "let",
      l: bind,
      m: def,
      r: def,
    }))
    .otherwise(identity);

const binds = (exp: Exp, bind: Bind): boolean =>
  pipe(
    exp,
    reduceExp(false, (yes, exp) =>
      yes ||
      match(exp)
        .with({ type: "bind", s: bind.s }, () => true)
        .otherwise(() => false)
    ),
  );

const evalMatch = (ma: State<Match>): State<Exp> =>
  match(evaluate({ ...ma, exp: ma.exp.l }))
    .with({ exp: { type: "fun" } }, fun =>
      ({ ...fun, exp: { ...ma.exp, l: fun.exp } })
    )
    .with({ exp: { type: "null" } }, nul => evaluate(nul.rewrite(
      { ...nul, exp: { ...ma.exp, l: nul.exp } },
      ma.exp.r,
    )))
    .otherwise(l => l.rewrite(
      { ...l, exp: { ...ma.exp, l: l.exp } },
      l.exp,
    ));

const evalApp = (app: State<App>): State<Exp> =>
  match(evaluate({ ...app, exp: app.exp.l }))
    .with({ exp: { type: "fun" } }, fun => evaluate(fun.rewrite(
      { ...fun, exp: { ...app.exp, l: fun.exp } },
      {
        type: "let",
        l: fun.exp.l,
        m: app.exp.r,
        r: fun.exp.r,
      },
    )))
    .with({ exp: { type: "match" } }, ma => evaluate(ma.rewrite(
      { ...ma, exp: { ...app.exp, l: ma.exp } },
      {
        ...ma.exp,
        l: { ...app.exp, l: ma.exp.l, ...getMeta(ma.exp.l) },
        r: { ...app.exp, l: ma.exp.r, ...getMeta(ma.exp.r) },
      },
    )))
    .otherwise(l => l.rewrite(
      { ...l, exp: { ...app.exp, l: l.exp } },
      { type: "null" },
    ));
