import {
  Exp,
  Val,
  Changes,
  mapExp,
  reduceExp,
  Time,
  getStyle,
  mapFocused,
  getVal,
  unsetMeta,
} from "./exp";
import * as R from "fp-ts/Record";
import { map, reduce } from "fp-ts/Array"
import * as S from "fp-ts/string";
import { flow, pipe } from "fp-ts/function";
import { Option, fold, getOrElse, none, some } from "fp-ts/Option";

const keys = (changes: Changes): Time[] =>
  pipe(
    R.keys(changes),
    map(parseInt),
  );

const reduceWithIndex = <A>(x: A, f: (time: Time, x: A, exp: Val) => A) =>
  (changes: Changes): A =>
    pipe(
      changes,
      R.reduceWithIndex(S.Ord)(x, (time, x, exp) =>
        f(parseInt(time), x, exp)
      ),
    );

const pop = (time: Time) => (changes: Changes): Option<[Val, Changes]> =>
  R.pop(time.toString())(changes);

const changesUnion = (a: Changes, b: Changes): Changes =>
  ({ ...a, ...b });

const addChange = (time: Time, change: Val, changes: Changes): Changes =>
  ({ ...changes, [time]: change })

const isEmpty = (changes: Changes): boolean => R.isEmpty(changes);

export const currentTime = (exp: Exp): Time =>
  Math.max(maxRedoTime(exp), maxUndoTime(exp));

const maxRedoTime = (exp: Exp): Time => pipe(
  exp,
  reduceExp(0, (time, exp) => pipe(
    exp.redos ?? {},
    keys,
    reduce(time, Math.max),
  ))
);

const minRedoTime = (exp: Exp): Time => pipe(
  exp,
  reduceExp(Infinity, (time, exp) => pipe(
    exp.redos ?? {},
    keys,
    reduce(time, Math.min),
  ))
);

const maxUndoTime = (exp: Exp): Time => pipe(
  exp,
  reduceExp(0, (time, exp) => pipe(
    exp.undos ?? {},
    keys,
    reduce(time, Math.max),
  ))
);

const timeAfter = (current: Time, time: Time, changes: Changes): Time =>
  pipe(
    changes,
    reduceWithIndex(none, (t, after: Option<Time>, _) =>
      pipe(
        after,
        fold(
          () => t > time ? some(t) : none,
          after => some(t > time ? Math.min(t, after) : after),
        ),
      )
    ),
    getOrElse(() => current + 1),
  );

const firstTime = (current: Time, changes: Changes): Time =>
  timeAfter(current, 0, changes);

export const wipeHistory = (exp: Exp): Exp =>
  pipe(
    exp,
    mapExp(flow(unsetMeta("undos"), unsetMeta("redos"))),
  );

const addChangeExp = (current: Time, change: Exp) => (exp: Exp): Exp => ({
  ...wipeHistory(change),
  undos: addChange(
    firstTime(current, exp.redos ?? {}),
    getVal(exp),
    changesUnion(exp.undos ?? {}, shiftChangesForward(current, exp.redos ?? {})),
  ),
  redos: {},
});

const shiftChangesForward = (current: Time, changes: Changes): Changes =>
  pipe(
    changes,
    reduceWithIndex({}, (time, shifted, val) =>
      addChange(timeAfter(current, time, changes), val, shifted)
    ),
  );

export const edit = (current: Time, change: Exp) => (exp: Exp): Exp =>
  addChangeExp(current, change)(exp);

export const editFocused = (change: Exp) => (root: Exp): Exp =>
  pipe(root, mapFocused(edit(currentTime(root), change)));

export const undo = (exp: Exp): Exp => {
  const time = maxUndoTime(exp);
  return pipe(
    exp,
    mapExp(exp => pipe(
      exp.undos ?? {},
      pop(time),
      fold(
        () => exp,
        ([val, undos]) => ({
          ...val,
          redos: addChange(time, exp, exp.redos ?? {}),
          undos,
          ...getStyle(exp),
        }),
      )
    )),
  );
}

export const redo = (exp: Exp): Exp => {
  const time = minRedoTime(exp);
  return pipe(
    exp,
    mapExp(exp => pipe(
      exp.redos ?? {},
      pop(time),
      fold(
        () => exp,
        ([val, redos]) => ({
          ...val,
          redos,
          undos: addChange(time, exp, exp.undos ?? {}),
          ...getStyle(exp),
        }),
      )
    )),
  );
}

export const hasUndo = (exp: Exp): boolean =>
  pipe(
    exp,
    reduceExp(false, (yes, exp) => yes || !isEmpty(exp.undos ?? {})),
  );

export const hasRedo = (exp: Exp): boolean =>
  pipe(
    exp,
    reduceExp(false, (yes, exp) => yes || !isEmpty(exp.redos ?? {})),
  );
