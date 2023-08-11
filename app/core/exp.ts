import { pipe, identity } from "fp-ts/function";
import { toArray } from "fp-ts/Record";
import { match, P } from "ts-pattern";
import { map, intercalate, reverse } from "fp-ts/Array"
import * as S from "fp-ts/string";

export type Exp = Val & Meta;

export type Val =
  | { type: "let"; l: Exp; m: Exp; r: Exp }
  | { type: "fun"; l: Exp; r: Exp }
  | { type: "match"; l: Exp; r: Exp }
  | { type: "app"; l: Exp; r: Exp }
  | { type: "cons"; l: Exp; r: Exp }
  | { type: "var"; s: string }
  | { type: "sym"; s: string }
  | { type: "null" };

export type Meta = History & Style;

export type History = {
  redos: Changes;
  undos: Changes;
};

export type Changes = Record<Time, Val>;

export type Time = number;

export type Style = {
  focused: boolean;
  inputting: boolean;
  hidden: boolean;
  newLine: boolean;
};

export type Binary = Exclude<Extract<Exp, { l: Exp; r: Exp }>, { m: Exp }>;

export type Unary = Extract<Exp, { s: string }>;

export type Leaf = Exclude<Exp, { l: Exp } | { m: Exp } | { r: Exp }>;

export type Let = Extract<Exp, { type: "let" }>;

export type Fun = Extract<Exp, { type: "fun" }>;

export type Match = Extract<Exp, { type: "match" }>;

export type App = Extract<Exp, { type: "app" }>;

export type Cons = Extract<Exp, { type: "cons" }>;

export type Var = Extract<Exp, { type: "var" }>;

export type Sym = Extract<Exp, { type: "sym" }>;

export type Null = Extract<Exp, { type: "null" }>;

export const getVal = (exp: Exp): Val => match(exp)
  .with({ type: "let" }, le => ({ type: le.type, l: le.l, m: le.m, r: le.r }))
  .with({ l: P._ }, exp => ({ type: exp.type, l: exp.l, r: exp.r }))
  .with({ s: P._ }, exp => ({ type: exp.type, s: exp.s, }))
  .with({ type: "null" }, exp => ({ type: exp.type }))
  .exhaustive();

export const getMeta = (exp: Exp): Meta => ({
  ...getHistory(exp),
  ...getStyle(exp),
});

export const getHistory = (exp: Exp): History => ({
  undos: exp.undos,
  redos: exp.redos,
});

export const getStyle = (exp: Exp): Style => ({
  focused: exp.focused,
  inputting: exp.inputting,
  hidden: exp.hidden,
  newLine: exp.newLine,
});

export const initHistory: History = {
  undos: {},
  redos: {},
};

export const initStyle: Style = {
  focused: false,
  inputting: false,
  hidden: false,
  newLine: false,
};

export const initMeta: Meta = {
  ...initHistory,
  ...initStyle,
};

export const isBinary = (exp: Val): exp is Binary =>
  "l" in exp && "r" in exp && !("m" in exp);

export const isUnary = (exp: Val): exp is Unary =>
  "s" in exp;

export const isLeaf = (exp: Val): exp is Leaf =>
  !("l" in exp) && !("r" in exp) && !("m" in exp);

export const mapExp = (f: (exp: Exp) => Exp) => (exp: Exp): Exp =>
  pipe(exp, mapSubExps(f), f);

export const mapSubExps = (f: (exp: Exp) => Exp) => (exp: Exp): Exp =>
  pipe(exp, onSubExps(mapExp(f)));

export const onSubExps = (f: (exp: Exp) => Exp) => (exp: Exp): Exp =>
  match(exp)
    .with({ type: "let" }, le => ({
      ...le,
      l: f(le.l),
      m: f(le.m),
      r: f(le.r),
    }))
    .with({ l: P._ }, exp => ({
      ...exp,
      l: f(exp.l),
      r: f(exp.r),
    }))
    .otherwise(identity);

export const reduceExp = <A>(a: A, f: (a: A, exp: Exp) => A) => (exp: Exp): A =>
  match(exp)
    .with({ type: "let" }, le =>
      f(reduceExp(reduceExp(reduceExp(a, f)(le.l), f)(le.m), f)(le.r), le)
    )
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
        .with({ type: "let" }, le => ({
          ...le,
          focused: le.l.focused || le.m.focused || le.r.focused,
        }))
        .with({ l: P._ }, exp => ({
          ...exp,
          focused: exp.l.focused || exp.r.focused,
        }))
        .otherwise(identity),
      onSubExps(exp => ({ ...exp, focused: false })),
      onSubExps(exp => navigate(exp, "up")),
    ))
    .with("down", () => pipe(
      exp,
      onSubExps(exp => navigate(exp, "down")),
      exp => match(exp)
        .with({ type: "let" }, le => ({
          ...le,
          l: { ...le.l, focused: le.l.focused || le.focused },
          focused: false,
        }))
        .with({ l: P._ }, exp => ({
          ...exp,
          l: { ...exp.l, focused: exp.l.focused || exp.focused },
          focused: false,
        }))
        .otherwise(identity),
    ))
    .with("left", () => pipe(
      match(exp)
        .with({ type: "let" }, le => ({
          ...le,
          l: { ...le.l, focused: le.l.focused || le.m.focused },
          m: { ...le.m, focused: le.r.focused },
          r: { ...le.r, focused: false },
        }))
        .with({ l: P._ }, exp => ({
          ...exp,
          l: { ...exp.l, focused: exp.l.focused || exp.r.focused },
          r: { ...exp.r, focused: false },
        }))
        .otherwise(identity),
      onSubExps(exp => navigate(exp, "left")),
    ))
    .with("right", () => pipe(
      match(exp)
        .with({ type: "let" }, le => ({
          ...le,
          l: { ...le.l, focused: false },
          m: { ...le.m, focused: le.l.focused },
          r: { ...le.r, focused: le.r.focused || le.m.focused },
        }))
        .with({ l: P._ }, exp => ({
          ...exp,
          l: { ...exp.l, focused: false },
          r: { ...exp.r, focused: exp.l.focused || exp.r.focused },
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
        .with({ type: "let" }, le => !le.l.focused && le.m.focused || !le.m.focused && le.r.focused)
        .with({ l: P._ }, exp => !exp.l.focused && exp.r.focused)
        .otherwise(() => false)
    ),
  );

export const rightNavigable = (exp: Exp): boolean =>
  pipe(
    exp,
    reduceExp(false, (yes, exp) =>
      yes ||
      match(exp)
        .with({ type: "let" }, le => le.l.focused && !le.m.focused || le.m.focused && !le.r.focused)
        .with({ l: P._ }, exp => exp.l.focused && !exp.r.focused)
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

const addNewlines = (lines: string[]): string =>
  pipe(lines, intercalate(S.Monoid)("\n"));

export const showHistory = (exp: Exp, indent: string = ""): string => addNewlines([
  ...showChanges(exp.redos, indent),
  indent + "now: " + showVal(exp),
  ...showChanges(exp.undos, indent),
  ...showSubHistories(exp, indent),
]);

export const showChanges = (changes: Changes, indent: string = ""): string[] =>
  pipe(
    changes,
    toArray,
    reverse,
    map(([time, exp]) => addNewlines([
      indent + time + ": " + showVal(exp),
      ...showSubHistories(exp, addIndent(indent)),
    ])),
  );

const showSubHistories = (exp: Val, indent: string = ""): string[] =>
  match(exp)
    .with({ type: "let" }, le => [
      indent + "l:",
      showHistory(le.l, addIndent(indent)),
      indent + "m:",
      showHistory(le.m, addIndent(indent)),
      indent + "r:",
      showHistory(le.r, addIndent(indent)),
    ])
    .with({ l: P._ }, exp => [
      indent + "l:",
      showHistory(exp.l, addIndent(indent)),
      indent + "r:",
      showHistory(exp.r, addIndent(indent)),
    ])
    .otherwise(() => []);

export const showVal = (exp: Val): string => match(exp)
  .with({ type: "let" }, le =>
    "(" + showVal(le.l) + " = " + showVal(le.m) + " " + showVal(le.r) + ")"
  )
  .with({ type: "fun" }, fun =>
    "(" + showVal(fun.l) + ": " + showVal(fun.r) + ")"
  )
  .with({ type: "match" }, ma =>
    "(" + showVal(ma.l) + " | " + showVal(ma.r) + ")"
  )
  .with({ type: "app" }, app =>
    "(" + showVal(app.l) + " " + showVal(app.r) + ")"
  )
  .with({ type: "cons" }, cons =>
    "(" + showVal(cons.l) + ", " + showVal(cons.r) + ")"
  )
  .with({ type: "var" }, va => va.s)
  .with({ type: "sym" }, sym => '"' + sym.s + '"')
  .with({ type: "null" }, () => "_")
  .exhaustive();

export const showStyle = (exp: Exp): string =>
  pipe(
    [
      ...(exp.focused ? ["focused"] : []),
      ...(exp.inputting ? ["inputting"] : []),
      ...(exp.hidden ? ["hidden"] : []),
      ...(exp.newLine ? ["newLine"] : []),
    ],
    intercalate(S.Monoid)(" "),
    s => s === "" ? s : "[" + s + "]",
  ) +
  match(exp)
    .with({ type: "let" }, le =>
      "(" + showStyle(le.l) + " = " + showStyle(le.m) + " " + showStyle(le.r) + ")"
    )
    .with({ type: "fun" }, fun =>
      "(" + showStyle(fun.l) + ": " + showStyle(fun.r) + ")"
    )
    .with({ type: "match" }, ma =>
      "(" + showStyle(ma.l) + " | " + showStyle(ma.r) + ")"
    )
    .with({ type: "app" }, app =>
      "(" + showStyle(app.l) + " " + showStyle(app.r) + ")"
    )
    .with({ type: "cons" }, cons =>
      "(" + showStyle(cons.l) + ", " + showStyle(cons.r) + ")"
    )
    .with({ type: "var" }, va => va.s)
    .with({ type: "sym" }, sym => '"' + sym.s + '"')
    .with({ type: "null" }, () => "_")
    .exhaustive();
