import {
  Exp,
  Binary,
  Unary,
  Null,
  update,
  mapExp,
  isUnary,
  focus,
  focused,
  unsetMeta,
  setMeta,
  getFocused,
} from "core/exp";
import { edit, nextTime } from "core/history";
import styles from "./styles.module.css";
import {
  ReactElement,
  MouseEvent,
  useRef,
  useEffect,
  MutableRefObject,
} from "react";
import { match } from "ts-pattern";
import classNames from "classnames";
import { pipe } from "fp-ts/function";
import { isEmpty, map, reduce } from "fp-ts/Array";

export default function Root(props: {
  exp: Exp,
  setExp: (exp: Exp) => void,
  container: MutableRefObject<HTMLDivElement | null>,
}): ReactElement {
  return (
    <Exp
      exp={props.exp}
      root={props.exp}
      container={props.container}
      update={props.setExp}
      focus={props.setExp}
      borderless={false}
    />
  );
}

type Props<E extends Exp> = {
  exp: E;
  root: Exp;
  container: MutableRefObject<HTMLDivElement | null>;
  update: (exp: Exp) => void;
  focus: (exp: Exp) => void;
  borderless: boolean;
};

const Exp = (props: Props<Exp>): ReactElement =>
  match(props.exp)
    .with({ type: "let" }, le => <Binary operator="=" props={{ ...props, exp: le }} />)
    .with({ type: "fun" }, fun => <Binary operator="›" props={{ ...props, exp: fun }} />)
    .with({ type: "match" }, ma => <Binary operator="|" props={{ ...props, exp: ma }} />)
    .with({ type: "app" }, app => <Binary props={{ ...props, exp: app }} />)
    .with({ type: "in" }, i => <Binary operator="in" props={{ ...props, exp: i }} />)
    .with({ type: "cons" }, cons => <Binary operator="," props={{ ...props, exp: cons }} />)
    .with({ type: "var" }, { type: "bind" }, { type: "sym" }, exp => <Unary {...props} exp={exp} />)
    .with({ type: "null" }, nul => <Null {...props} exp={nul} />)
    .exhaustive();

const Binary = <E extends Binary>({
  operator,
  props,
}: {
  operator?: string;
  props: Props<E>;
}): ReactElement => {
  const ref = useRef<HTMLDivElement | null>(null);
  useFocus(props, ref);

  return hide(
    props,
    <div
      className={style(props)}
      onClick={handleClick(props)}
    >
      {operator ?? "…"}
    </div>,
    <div
      className={style(props)}
      onClick={handleClick(props)}
      ref={ref}
    >
      <div className={styles.leftAndOperatorContainer}>
        <div className={styles.leftAndOperator}>
          <Exp
            {...props}
            exp={props.exp.l}
            update={l => pipe(
              props.exp,
              update({ ...props.exp, l }),
              props.update,
            )}
            focus={l => pipe(
              props.exp,
              pipe(
                {
                  ...props.exp,
                  l,
                  r: mapUnfocus(props.exp.r),
                },
                focus(false),
                update,
              ),
              props.focus,
            )}
            borderless={
              props.exp.l.type === props.exp.type &&
              associates(props.exp) === "left"
            }
          />
          {operator === undefined ? "" : operator}
        </div>
      </div>
      <Newline newline={props.exp.r.newline} />
      <Exp
        {...props}
        exp={props.exp.r}
        update={r => pipe(
          props.exp,
          update({ ...props.exp, r }),
          props.update,
        )}
        focus={r => pipe(
          props.exp,
          pipe(
            {
              ...props.exp,
              l: mapUnfocus(props.exp.l),
              r,
            },
            focus(false),
            update,
          ),
          props.focus,
        )}
        borderless={
          props.exp.r.type === props.exp.type &&
          associates(props.exp) === "right"
        }
      />
    </div>
  );
}

const Unary = <E extends Unary>(props: Props<E>): ReactElement => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useFocus(props, ref);
  useInput(props, ref);

  return hide(
    props,
    <div
      className={style(props)}
      onClick={handleClick(props)}
    >
      …
    </div>,
    <textarea
      ref={ref}
      className={style(props)}
      onMouseDown={e => {
        e.stopPropagation();
        if (!props.exp.inputting) {
          e.preventDefault();
        }
      }}
      onClick={e => {
        e.stopPropagation();
        if (!props.exp.inputting) {
          handleClick(props)(e);
        }
      }}
      onFocus={() => pipe(
        props.exp,
        mapUnfocus,
        setMeta("inputting", true),
        setMeta("focused", true),
        props.focus,
      )}
      onBlur={() => pipe(
        props.exp,
        pipe(props.exp, unsetMeta("inputting"), update),
        props.update,
      )}
      value={props.exp.s}
      onChange={e => {
        const s = e.target.value;
        pipe(
          props.exp,
          edit(nextTime(props.root), { ...props.exp, s }),
          props.update,
        );
      }}
      rows={props.exp.s.split("\n").length}
      cols={pipe(
        props.exp.s.split("\n"),
        map(s => s.length),
        reduce(1, Math.max),
      )}
      spellCheck={false}
    />
  );
}

const Null = (props: Props<Null>): ReactElement => {
  const ref = useRef<HTMLDivElement | null>(null);
  useFocus(props, ref);

  return hide(
    props,
    <div
      className={style(props)}
      onClick={handleClick(props)}
    >
      …
    </div>,
    <div
      className={style(props)}
      onClick={handleClick(props)}
      ref={ref}
    >
      &nbsp;
    </div>
  );
}

const Newline = (props: { newline?: true }) =>
  props.newline ? <hr className={styles.newline} /> : null;

const useFocus = (props: Props<Exp>, ref: MutableRefObject<HTMLElement | null>) =>
  useEffect(
    () => {
      if (ref.current && props.container.current && props.exp.focused) {
        ref.current.scrollIntoView({
          block:
            ref.current.clientHeight > props.container.current.clientHeight
              ? "start"
              : "center"
        })
      }
    },
    [props.exp.focused],
  );

const useInput = (props: Props<Exp>, ref: MutableRefObject<HTMLTextAreaElement | null>) =>
  useEffect(
    () => props.exp.inputting
      ? ref.current?.focus()
      : ref.current?.blur(),
    [props.exp.inputting],
  );

const handleClick = (props: Props<Exp>) => (e: MouseEvent<HTMLElement>) => {
  e.stopPropagation();
  e.ctrlKey
    ? pipe(
      props.exp,
      focus(!focused(props.exp)),
      props.update,
    )
    : pipe(
      props.exp,
      mapUnfocus,
      focus(!focused(props.exp)),
      props.focus,
    );
}

const hide = (props: Props<Exp>, hidden: ReactElement, visible: ReactElement): ReactElement =>
  shouldHide(props) ? hidden : visible;

const style = (props: Props<Exp>): string =>
  classNames(
    styles.exp,
    props.exp.focused ? styles.focused : "",
    props.borderless && !shouldHide(props) ? styles.borderless : "",
    isUnary(props.exp) ? styles.unary : "",
    props.exp.type === "bind" ? styles.bind : "",
    props.exp.type === "sym" ? styles.sym : "",
  );

const shouldHide = (props: Props<Exp>): boolean =>
  !!props.exp.hidden && !props.exp.inputting && pipe(props.exp, getFocused, isEmpty);

const mapUnfocus = (exp: Exp): Exp =>
  pipe(exp, mapExp(focus(false)));

const associates = (exp: Exp): "left" | "right" =>
  exp.type === "app" ? "left" : "right";
