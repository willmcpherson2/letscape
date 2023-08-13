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
  <div className={styles.header}>
    <Image
      src="/letscape.png"
      alt="letscape logo"
      width="48"
      height="48"
      quality={100}
    />
    <div className={styles.links}>
      <a href="/">
        <h1 className={styles.heading}>letscape</h1>
      </a>
      <a href="https://github.com/willmcpherson2/letscape">
        GitHub
      </a>
    </div>
  </div>
);
