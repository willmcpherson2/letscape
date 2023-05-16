import { Exp, showStyle } from "core/exp";
import { pipe } from "fp-ts/function";
import { fold, Option, some } from "fp-ts/Option";

export type Clipboard = Option<Exp>;

export const copy = (exp: Exp, _clipboard: Clipboard): Clipboard =>
  some(exp);

export const showClipboard = (clipboard: Clipboard): string =>
  pipe(
    clipboard,
    fold(
      () => "",
      showStyle,
    ),
  );
