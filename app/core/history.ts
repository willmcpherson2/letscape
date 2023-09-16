import { flow, pipe } from "fp-ts/function";
import {
  Exp,
  Time,
  Val,
  getStyle,
  mapExp,
  onSubExps,
  reduceExp,
  unsetMeta,
} from "./exp";

export const maxCurrentTime = (exp: Exp): Time =>
  pipe(
    exp,
    reduceExp(0, (time, exp) => Math.max(
      time,
      exp.time ?? 0,
    )),
  );

export const maxTime = (exp: Exp): Time =>
  pipe(
    exp,
    reduceExp(0, (time, exp) => Math.max(
      time,
      exp.time ?? 0,
      exp.undo ? maxTime(exp.undo) : 0,
      exp.redo ? maxTime(exp.redo) : 0,
    )),
  );

export const nextTime = (exp: Exp): Time =>
  maxTime(exp) + 1;

export const minRedoTime = (exp: Exp): Time =>
  pipe(
    exp,
    reduceExp(Infinity, (time, exp) => Math.min(
      time,
      exp.redo?.time ?? Infinity,
    )),
  );

export const edit = (time: Time, change: Val) => (exp: Exp): Exp => ({
  ...wipe(time, change),
  ...getStyle(exp),
  undo: redoAll(exp),
});

const redoAll = (exp: Exp): Exp =>
  hasRedo(exp) ? redoAll(redo(exp)) : exp;

export const editFocused = (time: Time, change: Exp) => (root: Exp): Exp =>
  root.focused
    ? pipe(
      root,
      edit(time, change),
      onSubExps(editFocused((change.time ?? 0) + 1, change)),
    )
    : pipe(
      root,
      onSubExps(editFocused(time, change)),
    );

export const undo = (exp: Exp): Exp => {
  const time = maxCurrentTime(exp);
  return pipe(
    exp,
    mapExp(e =>
      e.undo && e.time === time
        ? {
          ...e.undo,
          ...getStyle(e),
          redo: unsetMeta("undo")(e),
        }
        : e
    ),
  );
}

export const redo = (exp: Exp): Exp => {
  const time = minRedoTime(exp);
  return pipe(
    exp,
    mapExp(e =>
      e.redo && e.redo.time === time
        ? {
          ...e.redo,
          ...getStyle(e),
          undo: unsetMeta("redo")(e),
        }
        : e
    ),
  );
}

export const hasUndo = (exp: Exp): boolean =>
  pipe(
    exp,
    reduceExp(false, (yes, exp) => yes || !!exp.undo),
  );

export const hasRedo = (exp: Exp): boolean =>
  pipe(
    exp,
    reduceExp(false, (yes, exp) => yes || !!exp.redo),
  );

export const wipe = (time: Time, exp: Exp) =>
  pipe(
    exp,
    mapExp(flow(unsetMeta("undo"), unsetMeta("redo"))),
    mapExp(exp => ({ ...exp, time })),
  );
