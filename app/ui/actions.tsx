import styles from "./styles.module.css";
import {
  Exp,
  getFocused,
  inMeta,
  isLeaf,
  isUnary,
  leftNavigable,
  mapFocused,
  navigate,
  rightNavigable,
  setMeta,
  showHistory,
  showStyle,
  unsetMeta,
} from "core/exp";
import { ReactElement } from "react";
import { match } from "ts-pattern";
import { keyInfo, KeyInfo, mods } from "./utils";
import { exists, filter, head, isNonEmpty, map, size } from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import { fold, isSome } from "fp-ts/Option";
import { Clipboard, copy, showClipboard } from "ui/clipboard";
import { evaluate } from "core/eval";
import { edit, editFocused, hasRedo, hasUndo, currentTime, redo, undo } from "core/history";
import { pull, push } from "./remote";
import { log } from "core/utils";

export type Action = {
  type:
  | "push"
  | "pull"
  | "up"
  | "exitInput"
  | "redo"
  | "down"
  | "input"
  | "undo"
  | "left"
  | "right"
  | "hide"
  | "newLine"
  | "evaluate"
  | "copy"
  | "paste"
  | "let"
  | "fun"
  | "match"
  | "app"
  | "cons"
  | "var"
  | "sym"
  | "null"
  | "debug";
  key: KeyInfo;
  action: () => void;
  actionable: boolean;
};

export type Actions = Action[];

export default function Actions(props: { actions: Actions }): ReactElement {
  return (
    <table className={styles.actions}>
      <thead>
        <tr>
          <th>Action</th>
          <th>Key</th>
        </tr>
      </thead>
      <tbody>
        {pipe(
          props.actions,
          filter(action => action.actionable),
          map(action =>
            <Action
              key={action.type}
              action={action}
              title={match(action.type)
                .with("push", () => "Push")
                .with("pull", () => "Pull")
                .with("up", () => "Up")
                .with("down", () => "Down")
                .with("left", () => "Left")
                .with("right", () => "Right")
                .with("input", () => "Input")
                .with("exitInput", () => "Exit input")
                .with("redo", () => "Redo")
                .with("undo", () => "Undo")
                .with("hide", () => "Hide")
                .with("newLine", () => "New line")
                .with("evaluate", () => "Evaluate")
                .with("copy", () => "Copy")
                .with("paste", () => "Paste")
                .with("let", () => "Let")
                .with("fun", () => "Function")
                .with("match", () => "Match")
                .with("app", () => "Application")
                .with("cons", () => "Cons")
                .with("var", () => "Variable")
                .with("sym", () => "Symbol")
                .with("null", () => "Null")
                .with("debug", () => "Debug")
                .exhaustive()
              }
            />
          ))}
      </tbody>
    </table>
  );
}

const Action = (props: { title: string; action: Action }): ReactElement => (
  <tr>
    <td>
      <button
        onClick={e => {
          e.stopPropagation();
          props.action.action();
        }}
      >
        {props.title}
      </button>
    </td>
    <td>
      {props.action.key.alt ? "Alt " : null}
      {props.action.key.ctrl ? "Ctrl " : null}
      {props.action.key.shift ? "Shift " : null}
      {props.action.key.key}
    </td>
  </tr>
);

export const runActions = (actions: Actions) => (e: KeyboardEvent): void => {
  e.stopPropagation();
  pipe(
    actions,
    filter(action => action.actionable),
    map(action => match(keyInfo(e))
      .with(action.key, () => {
        e.preventDefault();
        action.action();
      })
      .otherwise(() => { })
    ),
  );
}

export const makeActions = (
  root: Exp,
  setExp: (exp: Exp) => void,
  clipboard: Clipboard,
  setClipboard: (clipboard: Clipboard) => void,
): Actions => {
  const focused = getFocused(root);
  const anyFocused = isNonEmpty(focused);
  const inputting = pipe(focused, exists(exp => exp.inputting !== undefined));
  const unaryFocused = pipe(focused, exists(isUnary));
  const leafFocused = pipe(focused, exists(isLeaf));
  const onlyRootFocused = root.focused && size(focused) === 1;
  const undoFocused = pipe(focused, exists(hasUndo));
  const redoFocused = pipe(focused, exists(hasRedo));

  return [
    {
      type: "push",
      key: mods("p"),
      action: () => push(root),
      actionable: !inputting,
    },
    {
      type: "pull",
      key: mods("P", "shift"),
      action: () => pull().then(exp => setExp(pipe(
        root,
        edit(currentTime(root), exp),
      ))),
      actionable: !inputting,
    },
    {
      type: "up",
      key: mods("ArrowUp"),
      action: () => setExp(navigate(root, "up")),
      actionable: !inputting && anyFocused && !onlyRootFocused,
    },
    {
      type: "exitInput",
      key: mods("ArrowUp"),
      action: () => setExp(pipe(
        root,
        mapFocused(unsetMeta("inputting")),
      )),
      actionable: inputting,
    },
    {
      type: "redo",
      key: mods("ArrowUp", "alt"),
      action: () => setExp(pipe(root, mapFocused(redo))),
      actionable: !inputting && redoFocused,
    },
    {
      type: "down",
      key: mods("ArrowDown"),
      action: () => setExp(navigate(root, "down")),
      actionable: !inputting && anyFocused && !leafFocused,
    },
    {
      type: "input",
      key: mods("ArrowDown"),
      action: () => setExp(pipe(
        root,
        mapFocused(exp => ({ ...exp, inputting: true })),
      )),
      actionable: !inputting && unaryFocused,
    },
    {
      type: "undo",
      key: mods("ArrowDown", "alt"),
      action: () => setExp(pipe(root, mapFocused(undo))),
      actionable: !inputting && undoFocused,
    },
    {
      type: "left",
      key: mods("ArrowLeft"),
      action: () => setExp(navigate(root, "left")),
      actionable: !inputting && leftNavigable(root),
    },
    {
      type: "right",
      key: mods("ArrowRight"),
      action: () => setExp(navigate(root, "right")),
      actionable: !inputting && rightNavigable(root),
    },
    {
      type: "hide",
      key: mods("Tab"),
      action: () => pipe(
        root,
        mapFocused(exp => pipe(
          exp,
          setMeta("hidden", !pipe(exp, inMeta("hidden"))),
        )),
        setExp,
      ),
      actionable: !inputting && anyFocused,
    },
    {
      type: "newLine",
      key: mods("Enter"),
      action: () => pipe(
        root,
        mapFocused(exp => pipe(
          exp,
          setMeta("newLine", !pipe(exp, inMeta("newLine"))),
        )),
        setExp,
      ),
      actionable: !inputting && anyFocused,
    },
    {
      type: "evaluate",
      key: mods("e"),
      action: () => pipe(
        root,
        mapFocused(evaluate),
        exp => edit(currentTime(root), exp)(root),
        setExp,
      ),
      actionable: !inputting,
    },
    {
      type: "copy",
      key: mods("c", "ctrl"),
      action: () => pipe(
        focused,
        head,
        fold(
          () => { },
          exp => setClipboard(copy(exp, clipboard))
        ),
      ),
      actionable: !inputting && anyFocused,
    },
    {
      type: "paste",
      key: mods("v", "ctrl"),
      action: () => pipe(
        clipboard,
        fold(
          () => { },
          exp => setExp(pipe(root, editFocused(exp)))
        )
      ),
      actionable: !inputting && anyFocused && isSome(clipboard),
    },
    {
      type: "let",
      key: mods("l"),
      action: () => setExp(pipe(
        root,
        editFocused({
          type: "let",
          l: { type: "null" },
          m: { type: "null" },
          r: { type: "null" },
          focused: true,
        }),
      )),
      actionable: !inputting && anyFocused,
    },
    {
      type: "fun",
      key: mods("f"),
      action: () => setExp(pipe(
        root,
        editFocused({
          type: "fun",
          l: { type: "null" },
          r: { type: "null" },
          focused: true,
        }),
      )),
      actionable: !inputting && anyFocused,
    },
    {
      type: "match",
      key: mods("m"),
      action: () => setExp(pipe(
        root,
        editFocused({
          type: "match",
          l: { type: "null" },
          r: { type: "null" },
          focused: true,
        }),
      )),
      actionable: !inputting && anyFocused,
    },
    {
      type: "app",
      key: mods("a"),
      action: () => setExp(pipe(
        root,
        editFocused({
          type: "app",
          l: { type: "null" },
          r: { type: "null" },
          focused: true,
        }),
      )),
      actionable: !inputting && anyFocused,
    },
    {
      type: "cons",
      key: mods("c"),
      action: () => setExp(pipe(
        root,
        editFocused({
          type: "cons",
          l: { type: "null" },
          r: { type: "null" },
          focused: true,
        }),
      )),
      actionable: !inputting && anyFocused,
    },
    {
      type: "var",
      key: mods("v"),
      action: () => setExp(pipe(
        root,
        editFocused({
          type: "var",
          s: "",
          focused: true,
          inputting: true,
        }),
      )),
      actionable: !inputting && anyFocused,
    },
    {
      type: "sym",
      key: mods("s"),
      action: () => setExp(pipe(
        root,
        editFocused({
          type: "sym",
          s: "",
          focused: true,
          inputting: true,
        }),
      )),
      actionable: !inputting && anyFocused,
    },
    {
      type: "null",
      key: mods("n"),
      action: () => setExp(pipe(
        root,
        editFocused({
          type: "null",
          focused: true,
        }),
      )),
      actionable: !inputting && anyFocused,
    },
    {
      type: "debug",
      key: mods("d"),
      action: () => pipe(
        focused,
        map(exp => {
          log("history:");
          log(showHistory(exp));
          log("style:");
          log(showStyle(exp));
          log("clipboard:");
          log(showClipboard(clipboard));
        })
      ),
      actionable: !inputting && anyFocused,
    },
  ];
}
