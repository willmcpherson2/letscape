import { Exp, showVal } from "./exp";

export const log = <T>(x: T): T => {
  console.log(x);
  return x;
};

export const logExp = (exp: Exp): Exp => {
  console.log(showVal(exp));
  return exp;
};
