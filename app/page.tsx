import { pull } from "ui/remote";
import { ReactElement } from "react";
import Editor from "ui/editor";

export default async function Page(): Promise<ReactElement> {
  const exp = await pull();
  return <Editor exp={exp} />;
}
