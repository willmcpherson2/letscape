import { pipe, identity } from "fp-ts/function";
import { match, P } from "ts-pattern";
import { intercalate } from "fp-ts/Array"
import * as S from "fp-ts/string";

export type Exp = Val & Meta;

export type Val =
  | { type: "let"; l: Exp; r: Exp }
  | { type: "fun"; l: Exp; r: Exp }
  | { type: "match"; l: Exp; r: Exp }
  | { type: "app"; l: Exp; r: Exp }
  | { type: "in"; l: Exp; r: Exp }
  | { type: "cons"; l: Exp; r: Exp }
  | { type: "var"; s: string }
  | { type: "bind"; s: string }
  | { type: "sym"; s: string }
  | { type: "null" };

export type Meta = History & Style;

export type History = Partial<{
  redo: Exp;
  time: Time;
  undo: Exp;
}>;

export type Time = number;

export type Style = Partial<{
  focused: true;
  inputting: true;
  hidden: true;
  newline: true;
}>;

export type Binary = Extract<Exp, { l: Exp; r: Exp }>;

export type Unary = Extract<Exp, { s: string }>;

export type Leaf = Exclude<Exp, { l: Exp } | { r: Exp }>;

export type Let = Extract<Exp, { type: "let" }>;

export type Fun = Extract<Exp, { type: "fun" }>;

export type Match = Extract<Exp, { type: "match" }>;

export type App = Extract<Exp, { type: "app" }>;

export type In = Extract<Exp, { type: "in" }>;

export type Cons = Extract<Exp, { type: "cons" }>;

export type Var = Extract<Exp, { type: "var" }>;

export type Bind = Extract<Exp, { type: "bind" }>;

export type Sym = Extract<Exp, { type: "sym" }>;

export type Null = Extract<Exp, { type: "null" }>;

export const isData = (exp: Exp): boolean =>
  match(exp)
    .with(
      { type: "let" },
      { type: "fun" },
      { type: "cons" },
      { type: "bind" },
      { type: "sym" },
      { type: "null" },
      { type: "match", l: { type: "fun" } },
      () => true
    )
    .with({ type: "match", l: { type: "match" } }, ma => isData(ma.l))
    .otherwise(() => false);

export const isCode = (exp: Exp): boolean => !isData(exp);

export const getVal = (exp: Exp): Val => match(exp)
  .with({ l: P._ }, exp => ({ type: exp.type, l: exp.l, r: exp.r }))
  .with({ s: P._ }, exp => ({ type: exp.type, s: exp.s, }))
  .with({ type: "null" }, exp => ({ type: exp.type }))
  .exhaustive();

export const getMeta = (exp: Exp): Meta => ({
  ...getHistory(exp),
  ...getStyle(exp),
});

export const getHistory = (exp: Exp): History => ({
  undo: exp.undo,
  time: exp.time,
  redo: exp.redo,
});

export const getStyle = (exp: Exp): Style => ({
  focused: exp.focused,
  inputting: exp.inputting,
  hidden: exp.hidden,
  newline: exp.newline,
});

export const setMeta = (k: keyof Meta, x: boolean) => (exp: Exp): Exp =>
  x ? { ...exp, [k]: true } : unsetMeta(k)(exp);

export const unsetMeta = (k: keyof Meta) => (exp: Exp): Exp => {
  const { [k]: _, ...e } = exp;
  return e;
};

export const inMeta = (k: keyof Meta) => (exp: Exp): boolean =>
  exp[k] !== undefined;

export const focus = (x: boolean) => (exp: Exp): Exp =>
  setMeta("focused", x)(exp);

export const focused = (exp: Exp): boolean =>
  inMeta("focused")(exp);

export const isBinary = (exp: Val): exp is Binary =>
  "l" in exp && "r" in exp;

export const isUnary = (exp: Val): exp is Unary =>
  "s" in exp;

export const isLeaf = (exp: Val): exp is Leaf =>
  !("l" in exp) && !("r" in exp);

export const mapExp = (f: (exp: Exp) => Exp) => (exp: Exp): Exp =>
  pipe(exp, mapSubExps(f), f);

export const mapSubExps = (f: (exp: Exp) => Exp) => (exp: Exp): Exp =>
  pipe(exp, onSubExps(mapExp(f)));

export const onSubExps = (f: (exp: Exp) => Exp) => (exp: Exp): Exp =>
  match(exp)
    .with({ l: P._ }, exp => ({
      ...exp,
      l: f(exp.l),
      r: f(exp.r),
    }))
    .otherwise(identity);

export const reduceExp = <A>(a: A, f: (a: A, exp: Exp) => A) => (exp: Exp): A =>
  match(exp)
    .with({ l: P._ }, exp =>
      f(reduceExp(reduceExp(a, f)(exp.l), f)(exp.r), exp)
    )
    .otherwise(exp => f(a, exp));

export type Direction =
  | "up"
  | "down"
  | "left"
  | "right";

export const navigate = (exp: Exp, direction: Direction): Exp =>
  match(direction)
    .with("up", () => pipe(
      match(exp)
        .with({ l: P._ }, exp => pipe(
          exp,
          focus(focused(exp.l) || focused(exp.r)),
        ))
        .otherwise(identity),
      onSubExps(focus(false)),
      onSubExps(exp => navigate(exp, "up")),
    ))
    .with("down", () => pipe(
      exp,
      onSubExps(exp => navigate(exp, "down")),
      exp => match(exp)
        .with({ l: P._ }, exp => pipe(
          {
            ...exp,
            l: pipe(exp.l, focus(focused(exp.l) || focused(exp))),
          },
          focus(false),
        ))
        .otherwise(identity),
    ))
    .with("left", () => pipe(
      match(exp)
        .with({ l: P._ }, exp => ({
          ...exp,
          l: pipe(exp.l, focus(focused(exp.l) || focused(exp.r))),
          r: pipe(exp.r, focus(false)),
        }))
        .otherwise(identity),
      onSubExps(exp => navigate(exp, "left")),
    ))
    .with("right", () => pipe(
      match(exp)
        .with({ l: P._ }, exp => ({
          ...exp,
          l: pipe(exp.l, focus(false)),
          r: pipe(exp.r, focus(focused(exp.l) || focused(exp.r))),
        }))
        .otherwise(identity),
      onSubExps(exp => navigate(exp, "right")),
    ))
    .exhaustive();

export const leftNavigable = (exp: Exp): boolean =>
  pipe(
    exp,
    reduceExp(false, (yes, exp) =>
      yes ||
      match(exp)
        .with({ l: P._ }, exp => !focused(exp.l) && focused(exp.r))
        .otherwise(() => false)
    ),
  );

export const rightNavigable = (exp: Exp): boolean =>
  pipe(
    exp,
    reduceExp(false, (yes, exp) =>
      yes ||
      match(exp)
        .with({ l: P._ }, exp => focused(exp.l) && !focused(exp.r))
        .otherwise(() => false)
    ),
  );

export const mapFocused = (f: (exp: Exp) => Exp) => (root: Exp): Exp =>
  pipe(
    root,
    mapExp(exp => exp.focused ? f(exp) : exp),
  );

export const update = (change: Exp) => (exp: Exp): Exp => ({
  ...change,
  ...getHistory(exp),
});

export const updateFocused = (change: Exp) => (root: Exp): Exp =>
  pipe(root, mapFocused(update(change)));

export const getFocused = (root: Exp): Exp[] =>
  pipe(
    root,
    reduceExp<Exp[]>([], (exps, exp) => exp.focused ? [...exps, exp] : exps),
  );

const addIndent = (indent: string): string => indent + "  ";

export const showHistory = (exp: Exp, indent: string = ""): string =>
  (exp.undo ? showHistory(exp.undo, addIndent(indent)) : "") +
  (indent + (exp.time ?? 0) + ": " + showVal(exp) + "\n") +
  showSubHistories(exp, indent) +
  (exp.redo ? showHistory(exp.redo, addIndent(indent)) : "");

const showSubHistories = (exp: Val, indent: string = ""): string =>
  match(exp)
    .with({ l: P._ }, exp =>
      indent + "l:" + "\n" +
      showHistory(exp.l, addIndent(indent)) +
      indent + "r:" + "\n" +
      showHistory(exp.r, addIndent(indent))
    )
    .otherwise(() => "");

export const showVal = (exp: Val): string => match(exp)
  .with({ type: "let" }, le =>
    "(" + showVal(le.l) + " = " + + showVal(le.r) + ")"
  )
  .with({ type: "fun" }, fun =>
    "(" + showVal(fun.l) + " -> " + showVal(fun.r) + ")"
  )
  .with({ type: "match" }, ma =>
    "(" + showVal(ma.l) + " | " + showVal(ma.r) + ")"
  )
  .with({ type: "app" }, app =>
    "(" + showVal(app.l) + " " + showVal(app.r) + ")"
  )
  .with({ type: "in" }, app =>
    "(" + showVal(app.l) + " in " + showVal(app.r) + ")"
  )
  .with({ type: "cons" }, cons =>
    "(" + showVal(cons.l) + ", " + showVal(cons.r) + ")"
  )
  .with({ type: "var" }, va => va.s)
  .with({ type: "bind" }, bind => "*" + bind.s)
  .with({ type: "sym" }, sym => ":" + sym.s)
  .with({ type: "null" }, () => "_")
  .exhaustive();

export const showStyle = (exp: Exp): string =>
  pipe(
    [
      ...(exp.focused ? ["focused"] : []),
      ...(exp.inputting ? ["inputting"] : []),
      ...(exp.hidden ? ["hidden"] : []),
      ...(exp.newline ? ["newline"] : []),
    ],
    intercalate(S.Monoid)(" "),
    s => s === "" ? s : "[" + s + "]",
  ) +
  match(exp)
    .with({ type: "let" }, le =>
      "(" + showStyle(le.l) + " = " + showStyle(le.r) + ")"
    )
    .with({ type: "fun" }, fun =>
      "(" + showStyle(fun.l) + " -> " + showStyle(fun.r) + ")"
    )
    .with({ type: "match" }, ma =>
      "(" + showStyle(ma.l) + " | " + showStyle(ma.r) + ")"
    )
    .with({ type: "app" }, app =>
      "(" + showStyle(app.l) + " " + showStyle(app.r) + ")"
    )
    .with({ type: "in" }, app =>
      "(" + showStyle(app.l) + " in " + showStyle(app.r) + ")"
    )
    .with({ type: "cons" }, cons =>
      "(" + showStyle(cons.l) + ", " + showStyle(cons.r) + ")"
    )
    .with({ type: "var" }, va => va.s)
    .with({ type: "bind" }, bind => "*" + bind.s)
    .with({ type: "sym" }, sym => ":" + sym.s)
    .with({ type: "null" }, () => "_")
    .exhaustive();
