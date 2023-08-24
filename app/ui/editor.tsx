"use client";

import { Exp } from "core/exp";
import Root from "./exp";
import { ReactElement, useEffect, useRef, useState } from "react";
import Actions, { makeActions, runActions } from "./actions";
import { Clipboard } from "./clipboard";
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

  useEffect(() => {
    const handleKeyDown = runActions(actions);
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [actions]);

  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <div className={styles.editor}>
      <div className={styles.editorExp} ref={ref}>
        <Root exp={exp} setExp={setExp} container={ref} />
      </div>
      <div className={styles.editorActions}>
        <Actions actions={actions} />
      </div>
    </div>
  );
}
