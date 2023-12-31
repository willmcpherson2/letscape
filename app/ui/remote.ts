"use server";

import { Exp } from "core/exp";
import { nextTime, edit } from "core/history";
import { pipe } from "fp-ts/function";
import { readFile, writeFile } from "node:fs/promises";

const init: Exp = {
  type: "null",
  time: 1,
  focused: true,
};

const dbFilename = (): string => process.env.LETSCAPE_DB ?? "/tmp/db.json";

export const pull = async (): Promise<Exp> => {
  try {
    const s = await readFile(dbFilename(), "utf8");
    const exp = JSON.parse(s);
    return exp;
  } catch (err) {
    return init;
  }
}

export const push = async (exp: Exp) => {
  const e = await pull();
  const s = pipe(e, edit(nextTime(e), exp), JSON.stringify);
  await writeFile(dbFilename(), s, "utf8");
}
