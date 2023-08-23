import {
  Exp,
  Binary,
  Unary,
  Let,
  Null,
  update,
  mapExp,
  isUnary,
  focus,
  focused,
  unsetMeta,
  setMeta,
} from "core/exp";
import { edit, currentTime } from "core/history";
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
import { map, reduce } from "fp-ts/Array";

export default function Root(props: {
  exp: Exp,
  setExp: (exp: Exp) => void;
}): ReactElement {
  return (
    <Exp
      exp={props.exp}
      root={props.exp}
      update={props.setExp}
      focus={props.setExp}
      pattern={false}
      borderless={false}
    />
  );
}

type Props<E extends Exp> = {
  exp: E;
  root: Exp;
  update: (exp: Exp) => void;
  focus: (exp: Exp) => void;
  pattern: boolean;
  borderless: boolean;
};

const Exp = (props: Props<Exp>): ReactElement =>
  match(props.exp)
    .with({ type: "let" }, le => <Let {...props} exp={le} />)
    .with({ type: "fun" }, fun => <Binary operator="›" props={{ ...props, exp: fun }} />)
    .with({ type: "match" }, ma => <Binary operator="|" props={{ ...props, exp: ma }} />)
    .with({ type: "app" }, app => <Binary props={{ ...props, exp: app }} />)
    .with({ type: "cons" }, cons => <Binary operator="," props={{ ...props, exp: cons }} />)
    .with({ type: "var" }, va => <Unary {...props} exp={va} />)
    .with({ type: "sym" }, sym => <Unary {...props} exp={sym} />)
    .with({ type: "null" }, nul => <Null {...props} exp={nul} />)
    .exhaustive();

const Let = (props: Props<Let>): ReactElement => {
  const ref = useRef<HTMLDivElement | null>(null);
  onFocus(props, ref);

  return (
    <div
      className={style(props)}
      onClick={handleClick(props)}
      ref={ref}
    >
      {hide(
        "=",
        props,
        <>
          <div className={styles.noOverflow}>
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
                    m: mapUnfocus(props.exp.m),
                    r: mapUnfocus(props.exp.r),
                  },
                  focus(false),
                  update,
                ),
                props.focus,
              )}
              pattern={true}
              borderless={false}
            />
            =
          </div>
          <div className={styles.noOverflow}>
            <Exp
              {...props}
              exp={props.exp.m}
              update={m => pipe(
                props.exp,
                update({ ...props.exp, m }),
                props.update,
              )}
              focus={m => pipe(
                props.exp,
                pipe(
                  {
                    ...props.exp,
                    l: mapUnfocus(props.exp.l),
                    m,
                    r: mapUnfocus(props.exp.r),
                  },
                  focus(false),
                  update,
                ),
                props.focus,
              )}
              pattern={props.pattern}
              borderless={false}
            />
          </div>
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
                  m: mapUnfocus(props.exp.m),
                  r,
                },
                focus(false),
                update,
              ),
              props.focus,
            )}
            pattern={props.pattern}
            borderless={props.exp.r.type === "let"}
          />
        </>
      )}
    </div>
  );
}

const Binary = <E extends Binary>({
  operator,
  props,
}: {
  operator?: string;
  props: Props<E>;
}): ReactElement => {
  const ref = useRef<HTMLDivElement | null>(null);
  onFocus(props, ref);

  return (
    <div
      className={style(props)}
      onClick={handleClick(props)}
      ref={ref}
    >
      {hide(
        operator === undefined ? "…" : operator,
        props,
        <>
          <div className={styles.noOverflow}>
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
              pattern={props.exp.type === "fun" || props.pattern}
              borderless={
                props.exp.l.type === props.exp.type &&
                associates(props.exp) === "left"
              }
            />
            {operator === undefined ? "" : operator}
          </div>
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
            pattern={props.pattern}
            borderless={
              props.exp.r.type === props.exp.type &&
              associates(props.exp) === "right"
            }
          />
        </>
      )}
    </div>
  );
}

const Unary = <E extends Unary>(props: Props<E>): ReactElement => {
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  onFocus(props, ref);
  onInput(props, inputRef);

  return (
    <div className={style(props)} onClick={handleClick(props)}>
      {hide(
        "…",
        props,
        <textarea
          ref={inputRef}
          onClick={e => e.stopPropagation()}
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
              edit(currentTime(props.root), { ...props.exp, s }),
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
      )}
    </div>
  );
}

const Null = (props: Props<Null>): ReactElement => {
  const ref = useRef<HTMLDivElement | null>(null);
  onFocus(props, ref);

  return (
    <div
      className={style(props)}
      onClick={handleClick(props)}
      ref={ref}
    >
      {hide("…", props, <>&nbsp;</>)}
    </div>
  );
}

const onFocus = (props: Props<Exp>, ref: MutableRefObject<HTMLDivElement | null>) =>
  useEffect(
    () => {
      if (props.exp.focused) {
        ref.current?.scrollIntoView();
      }
    },
    [props.exp.focused],
  );

const onInput = (props: Props<Exp>, ref: MutableRefObject<HTMLTextAreaElement | null>) =>
  useEffect(
    () => props.exp.inputting
      ? ref.current?.focus()
      : ref.current?.blur(),
    [props.exp.inputting],
  );

const hide = (operator: string, props: Props<Exp>, el: ReactElement): ReactElement =>
  props.exp.hidden ? <>{operator}</> : el;

const style = (props: Props<Exp>): string =>
  classNames(
    styles.exp,
    props.pattern ? styles.pattern : "",
    props.exp.focused ? styles.focused : "",
    props.borderless && !props.exp.hidden ? styles.borderless : "",
    isUnary(props.exp) ? styles.unary : "",
    props.exp.type === "sym" ? styles.bold : "",
    props.exp.newLine ? styles.newLine : "",
  );

const handleClick = (props: Props<Exp>) => (e: MouseEvent<HTMLDivElement>) => {
  e.stopPropagation();
  pipe(
    props.exp,
    mapUnfocus,
    focus(!focused(props.exp)),
    props.focus,
  );
}

const mapUnfocus = (exp: Exp): Exp =>
  pipe(exp, mapExp(focus(false)));

const associates = (exp: Exp): "left" | "right" =>
  exp.type === "app" ? "left" : "right";
