"use server";

import { Exp } from "core/exp";
import { currentTime, edit } from "core/history";
import { pipe } from "fp-ts/function";
import { readFile, writeFile } from "node:fs/promises";

const init: Exp = {
  type: "null",
  focused: true,
  inputting: false,
  hidden: false,
  newLine: false,
  redos: {},
  undos: {},
};

export const pull = async (): Promise<Exp> => {
  try {
    const s = await readFile("/tmp/db.json", "utf8");
    const exp = JSON.parse(s);
    return exp;
  } catch (err) {
    return init;
  }
}

export const push = async (exp: Exp) => {
  const e = await pull();
  const s = pipe(e, edit(currentTime(e), exp), JSON.stringify);
  await writeFile("/tmp/db.json", s, "utf8");
}
