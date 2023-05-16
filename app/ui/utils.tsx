import * as S from "fp-ts/string";
import { elem } from "fp-ts/Array";

export type KeyInfo = {
  key: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
};

export const keyInfo = (e: KeyboardEvent): KeyInfo => ({
  key: e.key,
  shift: e.shiftKey,
  ctrl: e.ctrlKey,
  alt: e.altKey,
});

export const mods = (key: string, ...ks: (keyof KeyInfo)[]): KeyInfo => ({
  key,
  shift: elem(S.Eq)("shift")(ks),
  ctrl: elem(S.Eq)("ctrl")(ks),
  alt: elem(S.Eq)("alt")(ks),
});
