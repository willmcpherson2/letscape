import { pull } from "ui/remote";
import { ReactElement } from "react";
import Editor from "ui/editor";
import Image from "next/image";
import styles from "ui/styles.module.css";

export default async function Page(): Promise<ReactElement> {
  const exp = await pull();

  return (
    <div className={styles.page}>
      <Header />
      <Editor exp={exp} />
    </div>
  );
}

const Header = (): ReactElement => (
  <a className={styles.header} href="/">
    <Image
      src="/letscape.png"
      alt="letscape logo"
      width="64"
      height="64"
      quality={100}
    />
    <h1 className={styles.headerText}>letscape</h1>
  </a>
);
