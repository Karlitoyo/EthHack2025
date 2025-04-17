import React, { ReactNode } from "react";
import Link from "next/link";
import Head from "next/head";

type Props = {
  children?: ReactNode;
  title?: string;
};

const Layout = ({ children, title = "This is the default title" }: Props) => (
  <div>
    <Head>
      <title>{title}</title>
      <meta charSet="utf-8" />
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <header>
      <nav className="navbar bg-base-100 rounded-box shadow-md">
        <div className="navbar-start">
          <ul className="menu menu-horizontal px-1">
            <li><Link href="/" className="btn btn-ghost normal-case text-xl">Home</Link></li>
            <li><Link href="/about" className="btn btn-ghost normal-case text-xl">About</Link></li>
          </ul>
        </div>
        <div className="navbar-center hidden lg:flex">
        </div>
      </nav>
    </header>
    {children}
    <footer className="footer sm:footer-horizontal footer-center bg-base-300 text-base-content p-4">
      <aside>
        <p>Karl Timmins Dissertation Copyright © {new Date().getFullYear()} - Zero Knowledge Medical Data</p>
      </aside>
    </footer>
  </div>
);

export default Layout;
