import styles from "./styles.module.css";
import {
  Exp,
  Val,
  getFocused,
  inMeta,
  isBinary,
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
import { ReactElement, useEffect, useState } from "react";
import { match } from "ts-pattern";
import { keyInfo, KeyInfo, mods } from "./key";
import { exists, head, isNonEmpty, map, size } from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import { fold, isSome } from "fp-ts/Option";
import { Clipboard, copy, showClipboard } from "ui/clipboard";
import { evalDeep, evalRewrite, needsEval, stepRewrite } from "core/eval";
import {
  edit,
  editFocused,
  hasRedo,
  hasUndo,
  nextTime,
  redo,
  undo,
} from "core/history";
import { pull, push } from "./remote";
import { log } from "core/utils";

export default function Actions({
  root,
  setExp,
  clipboard,
  setClipboard,
}: {
  root: Exp,
  setExp: (exp: Exp) => void,
  clipboard: Clipboard,
  setClipboard: (clipboard: Clipboard) => void,
}): ReactElement {
  const focused = getFocused(root);
  const anyFocused = isNonEmpty(focused);
  const inputting = pipe(focused, exists(exp => exp.inputting !== undefined));
  const unaryFocused = pipe(focused, exists(isUnary));
  const leafFocused = pipe(focused, exists(isLeaf));
  const onlyRootFocused = root.focused && size(focused) === 1;
  const undoFocused = pipe(focused, exists(hasUndo));
  const redoFocused = pipe(focused, exists(hasRedo));

  return (
    <table className={styles.actions}>
      <thead>
        <tr>
          <th>Action</th>
          <th>Key</th>
          <th>Info</th>
        </tr>
      </thead>
      <tbody>
        <Action
          title="Push"
          shortcut={mods("p")}
          action={() => push(root)}
          actionable={!inputting}
          info="Push the root expression to the server, where it will be saved in the undo history. This is public, so push something cool!"
        />
        <Action
          title="Pull"
          shortcut={mods("P", "shift")}
          action={() => pull().then(exp => pipe(
            root,
            edit(nextTime(root), exp),
            setExp,
          ))}
          actionable={!inputting}
          info="Pull the root expression from the server. Only really necessary if someone else has pushed."
        />
        <Action
          title="Up"
          shortcut={mods("ArrowUp")}
          action={() => setExp(navigate(root, "up"))}
          actionable={!inputting && anyFocused && !onlyRootFocused}
          info="Focus the parent of this expression."
        />
        <Action
          title="Exit"
          shortcut={mods("ArrowUp")}
          action={() => pipe(
            root,
            mapFocused(unsetMeta("inputting")),
            setExp,
          )}
          actionable={inputting}
          info="Stop editing text and focus the expression."
        />
        <Action
          title="Redo"
          shortcut={mods("ArrowUp", "alt")}
          action={() => pipe(root, mapFocused(redo), setExp)}
          actionable={!inputting && redoFocused}
          info="Redo the latest undo in the expression."
        />
        <Action
          title="Down"
          shortcut={mods("ArrowDown")}
          action={() => setExp(navigate(root, "down"))}
          actionable={!inputting && anyFocused && !leafFocused}
          info="Focus the first child of the expression."
        />
        <Action
          title="Input"
          shortcut={mods("ArrowDown")}
          action={() => pipe(
            root,
            mapFocused(exp => ({ ...exp, inputting: true })),
            setExp,
          )}
          actionable={!inputting && unaryFocused}
          info="Edit text of the expression."
        />
        <Action
          title="Undo"
          shortcut={mods("ArrowDown", "alt")}
          action={() => setExp(pipe(root, mapFocused(undo)))}
          actionable={!inputting && undoFocused}
          info="Undo the latest change in the expression."
        />
        <Action
          title="Left"
          shortcut={mods("ArrowLeft")}
          action={() => setExp(navigate(root, "left"))}
          actionable={!inputting && leftNavigable(root)}
          info="Focus the left sibling of the expression."
        />
        <Action
          title="Right"
          shortcut={mods("ArrowRight")}
          action={() => setExp(navigate(root, "right"))}
          actionable={!inputting && rightNavigable(root)}
          info="Focus the right sibling of the expression."
        />
        <Action
          title="Hide"
          shortcut={mods("Tab")}
          action={() => pipe(
            root,
            mapFocused(exp => pipe(
              exp,
              setMeta("hidden", !pipe(exp, inMeta("hidden"))),
            )),
            setExp,
          )}
          actionable={!inputting && anyFocused}
          info="Hide the expression while it is not focused. If the expression is already hidden, unhides it."
        />
        <Action
          title="Newline"
          shortcut={mods("Enter")}
          action={() => pipe(
            root,
            mapFocused(exp => pipe(
              exp,
              setMeta("newline", !pipe(exp, inMeta("newline"))),
            )),
            setExp,
          )}
          actionable={!inputting && anyFocused}
          info="Put the expression on a new line."
        />
        <Action
          title="Evaluate"
          shortcut={mods("e")}
          action={() => pipe(
            root,
            edit(
              nextTime(root),
              evalDeep({
                rewrite: evalRewrite,
                time: nextTime(root),
                exp: root,
              }).exp,
            ),
            setExp,
          )}
          actionable={!inputting && needsEval(root)}
          info="Evaluate the root expression."
        />
        <Action
          title="Step"
          shortcut={mods("E", "shift")}
          action={() => pipe(
            evalDeep({
              rewrite: stepRewrite,
              time: nextTime(root),
              exp: root,
            }).exp,
            setExp,
          )}
          actionable={!inputting && needsEval(root)}
          info="Evaluate the root expression, adding each step of the evaluation to the undo history."
        />
        <Action
          title="Copy"
          shortcut={mods("c", "ctrl")}
          action={() => pipe(
            focused,
            head,
            fold(
              () => { },
              exp => setClipboard(copy(exp, clipboard))
            ),
          )}
          actionable={!inputting && anyFocused}
          info="Copy the expression to the clipboard. Not your system clipboard."
        />
        <Action
          title="Paste"
          shortcut={mods("v", "ctrl")}
          action={() => pipe(
            clipboard,
            fold(
              () => { },
              exp => pipe(
                root,
                editFocused(nextTime(root), exp),
                setExp,
              ),
            ),
          )}
          actionable={!inputting && anyFocused && isSome(clipboard)}
          info="Set the expression to the expression in the clipboard. Not your system clipboard."
        />
        <Action
          title="Let"
          shortcut={mods("l")}
          action={() => newExp(
            root,
            setExp,
            {
              type: "let",
              l: { type: "null" },
              r: { type: "null" },
            },
          )}
          actionable={!inputting && anyFocused}
          info="Set the expression to a let. To use a let it must be applied. Supports pattern matching. Each side of a let is evaluated before pattern matching. Result is null if pattern matching fails. A let is data and can be pattern matched."
        />
        <Action
          title="Function"
          shortcut={mods("f")}
          action={() => newExp(
            root,
            setExp,
            {
              type: "fun",
              l: { type: "null" },
              r: { type: "null" },
            },
          )}
          actionable={!inputting && anyFocused}
          info="Set the expression to a function. Once applied, evaluates to a let. A function is data and can be pattern matched."
        />
        <Action
          title="Match"
          shortcut={mods("m")}
          action={() => newExp(
            root,
            setExp,
            {
              type: "match",
              l: { type: "null" },
              r: { type: "null" },
            },
          )}
          actionable={!inputting && anyFocused}
          info="Set the expression to a match. If the left evaluates to null, the result is the right. If a match is applied, the argument is applied to each side of the match. A match is data and can be pattern matched, but only if the left is a function or a match that is itself data."
        />
        <Action
          title="Application"
          shortcut={mods("a")}
          action={() => newExp(
            root,
            setExp,
            {
              type: "app",
              l: { type: "null" },
              r: { type: "null" },
            },
          )}
          actionable={!inputting && anyFocused}
          info="Set the expression to an application. The left hand side must be a let, function or match. An application is not data, so will be evaluated before pattern matching."
        />
        <Action
          title="In"
          shortcut={mods("i")}
          action={() => newExp(
            root,
            setExp,
            {
              type: "in",
              l: { type: "null" },
              r: { type: "null" },
            },
          )}
          actionable={!inputting && anyFocused}
          info="Set the expression to an in. Same as application but right-associative. An in is not data, so will be evaluated before pattern matching."
        />
        <Action
          title="Cons"
          shortcut={mods("c")}
          action={() => newExp(
            root,
            setExp,
            {
              type: "cons",
              l: { type: "null" },
              r: { type: "null" },
            },
          )}
          actionable={!inputting && anyFocused}
          info="Set the expression to a cons. If the root expression is a cons, it is evaluated deeply. A cons is data and can be pattern matched."
        />
        <Action
          title="Variable"
          shortcut={mods("v")}
          action={() => newExp(
            root,
            setExp,
            {
              type: "var",
              s: "",
            },
          )}
          actionable={!inputting && anyFocused}
          info="Set the expression to a variable. A variable must refer to a bind, otherwise it evaluates to null. A var is not data, so will be evaluated before pattern matching."
        />
        <Action
          title="Bind"
          shortcut={mods("b")}
          action={() => newExp(
            root,
            setExp,
            {
              type: "bind",
              s: "",
            },
          )}
          actionable={!inputting && anyFocused}
          info="Set the expression to a bind. In pattern matching, a bind will match anything and become available as a variable."
        />
        <Action
          title="Symbol"
          shortcut={mods("s")}
          action={() => newExp(
            root,
            setExp,
            {
              type: "sym",
              s: "",
            },
          )}
          actionable={!inputting && anyFocused}
          info="Set the expression to a symbol. In pattern matching, symbols must match literally."
        />
        <Action
          title="Null"
          shortcut={mods("n")}
          action={() => newExp(
            root,
            setExp,
            {
              type: "null",
            },
          )}
          actionable={!inputting && anyFocused}
          info="Set the expression to null. Null is a result of failed pattern matching. Null is data and can be pattern matched."
        />
        <Action
          title="Debug"
          shortcut={mods("d")}
          action={() => pipe(
            focused,
            map(exp => {
              log("history:");
              log(showHistory(exp));
              log("style:");
              log(showStyle(exp));
              log("clipboard:");
              log(showClipboard(clipboard));
            })
          )}
          actionable={!inputting && anyFocused}
          info="Print debug info to the browser console."
        />
      </tbody>
    </table>
  );
}

const Action = ({
  title,
  shortcut,
  action,
  actionable,
  info,
}: {
  title: string;
  shortcut: KeyInfo;
  action: () => void;
  actionable: boolean;
  info: string;
}): ReactElement | null => {
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => !actionable
      ? {}
      : match(keyInfo(e))
        .with(shortcut, () => {
          e.preventDefault();
          action();
        })
        .otherwise(() => { });
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [actionable, shortcut, action]);

  return !actionable
    ? null
    : <tr>
      <td>
        <button
          onClick={e => {
            e.stopPropagation();
            action();
          }}
        >
          {title}
        </button>
      </td>
      <td className={styles.shortcut}>
        {shortcut.alt ? "Alt " : null}
        {shortcut.ctrl ? "Ctrl " : null}
        {shortcut.shift ? "Shift " : null}
        {shortcut.key}
      </td>
      <td>
        <button onClick={() => setShowInfo(showInfo => !showInfo)}>
          ?
        </button>
        <div className={styles.info}>
          {showInfo ? info : ""}
        </div>
      </td>
    </tr>;
};

const newExp = (root: Exp, setExp: (exp: Exp) => void, change: Val) => {
  const time = nextTime(root);
  return pipe(
    root,
    mapFocused(exp => pipe(
      exp,
      edit(
        time,
        {
          ...change,
          ...(isBinary(change) && isBinary(exp) ? { l: exp.l, r: exp.r } : {}),
          ...(isUnary(change) && isUnary(exp) ? { s: exp.s } : {}),
        },
      ),
      exp => isUnary(exp) ? { ...exp, inputting: true } : exp,
    )),
    setExp,
  );
}
