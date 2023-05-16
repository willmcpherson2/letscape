import {
  Exp,
  Binary,
  Unary,
  Let,
  Null,
  update,
  mapExp,
  isUnary,
} from "core/exp";
import { edit, currentTime } from "core/history";
import styles from "./styles.module.css";
import { ReactElement, MouseEvent, useRef, useEffect } from "react";
import { match } from "ts-pattern";
import classNames from "classnames";
import { pipe } from "fp-ts/function";
import { map, reduce } from "fp-ts/Array";

export type Props<E extends Exp> = {
  exp: E;
  root: Exp;
  update: (exp: Exp) => void;
  focus: (exp: Exp) => void;
  pattern: boolean;
  borderless: boolean;
};

export default function Exp(props: Props<Exp>): ReactElement {
  return match(props.exp)
    .with({ type: "let" }, le => <Let {...props} exp={le} />)
    .with({ type: "fun" }, fun => <Binary operator="→" props={{ ...props, exp: fun }} />)
    .with({ type: "match" }, ma => <Binary operator="|" props={{ ...props, exp: ma }} />)
    .with({ type: "app" }, app => <Binary operator="" props={{ ...props, exp: app }} />)
    .with({ type: "cons" }, cons => <Binary operator=":" props={{ ...props, exp: cons }} />)
    .with({ type: "var" }, va => <Unary {...props} exp={va} />)
    .with({ type: "sym" }, sym => <Unary {...props} exp={sym} />)
    .with({ type: "null" }, nul => <Null {...props} exp={nul} />)
    .exhaustive();
}

const Let = (props: Props<Let>): ReactElement => (
  <div className={style(props)} onClick={handleClick(props)}>
    {hide(
      "=",
      props,
      <>
        <div className={styles.noOverflow}>
          <Exp
            {...props}
            exp={props.exp.l}
            update={l => props.update(pipe(
              props.exp,
              update({ ...props.exp, l }),
            ))}
            focus={l => props.focus(pipe(props.exp, update({
              ...props.exp,
              l,
              m: mapUnfocus(props.exp.m),
              r: mapUnfocus(props.exp.r),
              focused: false
            })))}
            pattern={true}
            borderless={false}
          />
          =
        </div>
        <div className={styles.noOverflow}>
          <Exp
            {...props}
            exp={props.exp.m}
            update={m => props.update(pipe(
              props.exp,
              update({ ...props.exp, m }),
            ))}
            focus={m => props.focus(pipe(props.exp, update({
              ...props.exp,
              l: mapUnfocus(props.exp.l),
              m,
              r: mapUnfocus(props.exp.r),
              focused: false
            })))}
            pattern={props.pattern}
            borderless={false}
          />
          in
        </div>
        <Exp
          {...props}
          exp={props.exp.r}
          update={r => props.update(pipe(
            props.exp,
            update({ ...props.exp, r }),
          ))}
          focus={r => props.focus(pipe(props.exp, update({
            ...props.exp,
            l: mapUnfocus(props.exp.l),
            m: mapUnfocus(props.exp.m),
            r,
            focused: false
          })))}
          pattern={props.pattern}
          borderless={props.exp.r.type === "let"}
        />
      </>
    )}
  </div>
);

const Binary = <E extends Binary>({
  operator,
  props,
}: {
  operator: string;
  props: Props<E>;
}): ReactElement => (
  <div className={style(props)} onClick={handleClick(props)}>
    {hide(
      operator === "" ? "…" : operator,
      props,
      <>
        <div className={styles.noOverflow}>
          <Exp
            {...props}
            exp={props.exp.l}
            update={l => props.update(pipe(
              props.exp,
              update({ ...props.exp, l }),
            ))}
            focus={l => props.focus(pipe(props.exp, update({
              ...props.exp,
              l,
              r: mapUnfocus(props.exp.r),
              focused: false
            })))}
            pattern={props.exp.type === "fun" || props.pattern}
            borderless={
              props.exp.l.type === props.exp.type &&
              associates(props.exp) === "left"
            }
          />
          {operator}
        </div>
        <Exp
          {...props}
          exp={props.exp.r}
          update={r => props.update(pipe(
            props.exp,
            update({ ...props.exp, r }),
          ))}
          focus={r => props.focus(pipe(props.exp, update({
            ...props.exp,
            l: mapUnfocus(props.exp.l),
            r,
            focused: false
          })))}
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

const Unary = <E extends Unary>(props: Props<E>): ReactElement => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(
    () => props.exp.inputting
      ? inputRef.current?.focus()
      : inputRef.current?.blur(),
    [props.exp.inputting],
  );

  return (
    <div className={style(props)} onClick={handleClick(props)}>
      {hide(
        "…",
        props,
        <textarea
          ref={inputRef}
          onClick={e => e.stopPropagation()}
          onFocus={() => props.focus(pipe(
            props.exp,
            mapUnfocus,
            exp => ({ ...exp, inputting: true, focused: true }),
          ))}
          onBlur={() => props.update(pipe(
            props.exp,
            update({ ...props.exp, inputting: false }),
          ))}
          value={props.exp.s}
          onChange={e => {
            const s = e.target.value;
            props.update(pipe(
              props.exp,
              edit(currentTime(props.root), { ...props.exp, s }),
            ));
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

const Null = (props: Props<Null>): ReactElement => (
  <div className={style(props)} onClick={handleClick(props)}>
    {hide("…", props, <>&nbsp;</>)}
  </div>
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
  props.focus(pipe(
    props.exp,
    mapUnfocus,
    exp => ({ ...exp, focused: !props.exp.focused }),
  ));
}

const mapUnfocus = (exp: Exp): Exp =>
  pipe(
    exp,
    mapExp(e => ({ ...e, focused: false })),
  );

const associates = (exp: Exp): "left" | "right" =>
  exp.type === "app" ? "left" : "right";
