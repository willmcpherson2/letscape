"use client";

import { Exp } from "core/exp";
import E from "./exp";
import { ReactElement, useEffect, useState } from "react";
import Actions, { makeActions, runActions } from "./actions";
import { log } from "core/utils";
import { showHistory, showStyle } from "core/exp";
import { Clipboard, showClipboard } from "./clipboard";
import { none } from "fp-ts/Option";
import styles from "./styles.module.css";

export default function Editor(props: { exp: Exp }): ReactElement {
  const [exp, setExp] = useState<Exp>(props.exp);
  const [clipboard, setClipboard] = useState<Clipboard>(none);
  const actions = makeActions(
    exp,
    setExp,
    clipboard,
    setClipboard,
  );

  log("history:");
  log(showHistory(exp));
  log("style:");
  log(showStyle(exp));
  log("clipboard:");
  log(showClipboard(clipboard));

  useEffect(() => {
    const handleKeyDown = runActions(actions);
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [actions]);

  return (
    <div className={styles.editor}>
      <div className={styles.editorExp}>
        <E
          exp={exp}
          root={exp}
          update={setExp}
          focus={setExp}
          pattern={false}
          borderless={false}
        />
      </div>
      <div className={styles.editorActions}>
        <Actions actions={actions} />
      </div>
    </div>
  );
}
