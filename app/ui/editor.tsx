"use client";

import { Exp } from "core/exp";
import Root from "./exp";
import { ReactElement, useRef, useState } from "react";
import Actions from "./actions";
import { Clipboard } from "./clipboard";
import { none } from "fp-ts/Option";
import styles from "./styles.module.css";

export default function Editor(props: { exp: Exp }): ReactElement {
  const [exp, setExp] = useState<Exp>(props.exp);
  const [clipboard, setClipboard] = useState<Clipboard>(none);

  const ref = useRef<HTMLDivElement | null>(null);

  return (
    <div className={styles.editor}>
      <div className={styles.editorExp} ref={ref}>
        <Root exp={exp} setExp={setExp} container={ref} />
      </div>
      <div className={styles.editorActions}>
        <Actions
          root={exp}
          setExp={setExp}
          clipboard={clipboard}
          setClipboard={setClipboard}
        />
      </div>
    </div>
  );
}
