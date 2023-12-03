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
    .with({ exp: { type: "app" } }, app => evalApp({ ...exp, exp: app.exp }))
    .with({ exp: { type: "in" } }, i => evaluate(exp.rewrite(
      { ...exp, exp: i.exp },
      { ...i.exp, type: "app" },
    )))
    .with({ exp: { type: "match" } }, ma => evalMatch({ ...exp, exp: ma.exp }))
    .with({ exp: { type: "var" } }, va => exp.rewrite(
      { ...exp, exp: va.exp },
      { type: "null" },
    ))
    .otherwise(identity);

const evalApp = (app: State<App>): State<Exp> =>
  match(evaluate({ ...app, exp: app.exp.l }))
    .with({ exp: { type: "let" } }, le => evalAppLet(le, app))
    .with({ exp: { type: "fun" } }, fun => evaluate(fun.rewrite(
      { ...fun, exp: { ...app.exp, l: fun.exp } },
      {
        type: "app",
        l: {
          type: "let",
          l: fun.exp.l,
          r: app.exp.r,
        },
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

const evalAppLet = (le: State<Let>, app: State<App>) =>
  match(evaluate({ ...le, exp: le.exp.l }))
    .with(
      { exp: { type: "let" } },
      { exp: { type: "match" } },
      { exp: { type: "fun" } },
      { exp: { type: "cons" } },
      l => unfold(l, le.exp, app.exp)
    )
    .with({ exp: { type: "sym" } }, l =>
      match(evaluate({ ...l, exp: le.exp.r }))
        .with({ exp: { type: "sym", s: l.exp.s } }, r => evaluate(r.rewrite(
          { ...r, exp: { ...app.exp, l: { ...le.exp, l: l.exp, r: r.exp } } },
          app.exp.r,
        )))
        .otherwise(r => r.rewrite(
          { ...r, exp: { ...app.exp, l: { ...le.exp, l: l.exp, r: r.exp } } },
          { type: "null" },
        ))
    )
    .with({ exp: { type: "null" } }, l =>
      match(evaluate({ ...l, exp: le.exp.r }))
        .with({ exp: { type: "null" } }, r => evaluate(r.rewrite(
          { ...r, exp: { ...app.exp, l: { ...le.exp, l: l.exp, r: r.exp } } },
          app.exp.r,
        )))
        .otherwise(r => r.rewrite(
          { ...r, exp: { ...app.exp, l: { ...le.exp, l: l.exp, r: r.exp } } },
          { type: "null" },
        ))
    )
    .with({ exp: { type: "bind" } }, bind => evaluate(bind.rewrite(
      { ...bind, exp: { ...app.exp, l: { ...le.exp, l: bind.exp } } },
      substitute(bind.exp, le.exp.r)(app.exp.r),
    )))
    .run();

const unfold = (l: State<Binary>, le: Let, app: App): State<Exp> =>
  match(evaluate({ ...l, exp: le.r }))
    .with({ exp: { type: l.exp.type } }, r => evaluate(r.rewrite(
      { ...r, exp: { ...app, l: { ...le, l: l.exp, r: r.exp } } },
      {
        type: "app",
        l: {
          type: "let",
          l: l.exp.l,
          r: r.exp.l,
        },
        r: {
          type: "app",
          l: {
            type: "let",
            l: l.exp.r,
            r: r.exp.r,
          },
          r: app.r,
        }
      }
    )))
    .otherwise(r => r.rewrite(
      { ...r, exp: { ...app, l: { ...le, l: l.exp, r: r.exp } } },
      { type: "null" }
    ));

const substitute = (bind: Bind, def: Exp) => (scope: Exp): Exp =>
  match(scope)
    .with({ type: "fun" }, fun =>
      binds(fun.l, bind)
        ? fun
        : onSubExps(substitute(bind, def))(fun)
    )
    .with({ type: "app", l: { type: "let" } }, { type: "in", l: { type: "let" } }, app =>
      binds(app.l.l, bind)
        ? app
        : onSubExps(substitute(bind, def))(app)
    )
    .with({ l: P._ }, onSubExps(substitute(bind, def)))
    .with({ type: "var", s: bind.s }, () => <App>({
      type: "app",
      l: {
        type: "let",
        l: bind,
        r: def,
      },
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
    .with({ exp: { type: "null" } }, nul => evaluate(nul.rewrite(
      { ...nul, exp: { ...ma.exp, l: nul.exp } },
      ma.exp.r,
    )))
    .with({ exp: { type: "fun" } }, { exp: { type: "match" } }, l =>
      ({ ...l, exp: { ...ma.exp, l: l.exp } })
    )
    .otherwise(l => l.rewrite(
      { ...l, exp: { ...ma.exp, l: l.exp } },
      l.exp,
    ));
