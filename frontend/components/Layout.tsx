import React, { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';

type Props = {
  children?: ReactNode;
  title?: string;
  stepIdx?: number;
};

type StepState = {
  id: number;
  label: string;
  className: string;
  href: string;
};

const Layout = ({ children, title = 'This is the default title', stepIdx = -1 }: Props) => {
  const initialState: StepState[] = [
    {
      id: 1,
      label: 'Register Family',
      className: 'step',
      href: '/',
    },
    {
      id: 2,
      label: 'Register User',
      className: 'step',
      href: '/userRegister',
    },
    {
      id: 3,
      label: 'Return Relation',
      className: 'step',
      href: '/returnRelation',
    },
    {
      id: 4,
      label: 'Generate Proof',
      className: 'step',
      href: '/generateProof',
    },
    {
      id: 5,
      label: 'Validate Proof',
      className: 'step',
      href: '/validateProof',
    },
  ];

  const [steps, setStepState] = useState(initialState);

  useEffect(() => {
    if (stepIdx > 0) {
      setStepState((prevSteps) =>
        prevSteps.map((step) => {
          if (step.id < stepIdx) {
            return { ...step, className: 'step step-primary' };
          }
          if (step.id === stepIdx) {
            return { ...step, className: 'step step-primary' };
          }
          return step;
        })
      );
    }
  }, [stepIdx]);

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta charSet='utf-8' />
        <meta
          name='viewport'
          content='initial-scale=1.0, width=device-width'
        />
      </Head>
      <header>
        <nav className='navbar bg-base-100 rounded-box shadow-md'>
          <div className='navbar-start'>
            <ul className='menu menu-horizontal px-1'>
              <li>
                <Link
                  href='/'
                  className='btn btn-ghost normal-case text-xl'
                >
                  Paternal Relation
                </Link>
              </li>
              <li>
                <Link
                  href='/userRegister'
                  className='btn btn-ghost normal-case text-xl'
                >
                  Your Information
                </Link>
              </li>
              <li>
                <Link
                  href='/returnRelation'
                  className='btn btn-ghost normal-case text-xl'
                >
                  Return Relation
                </Link>
              </li>
              <li>
                <Link
                  href='/generateProof'
                  className='btn btn-ghost normal-case text-xl'
                >
                  Generate Proof
                </Link>
              </li>
              <li>
                <Link
                  href='/validateProof'
                  className='btn btn-ghost normal-case text-xl'
                >
                  Validate Proof
                </Link>
              </li>
            </ul>
          </div>
          <div className='navbar-center hidden lg:flex'></div>
        </nav>
        <div className='flex justify-center p-4'>
          <ul className='steps steps-horizontal space-x-2'>
            {steps.map((step) => (
              <li
                key={step.id}
                className={step.className}
              >
                {step.label}
              </li>
            ))}
          </ul>
        </div>
      </header>
      {children}
      <footer className='footer sm:footer-horizontal footer-center bg-base-300 text-base-content p-4 fixed bottom-0 w-full'>
        <aside>
          <p>Karl Timmins Dissertation Copyright © {new Date().getFullYear()} - Zero Knowledge Medical Data</p>
        </aside>
      </footer>
    </div>
  );
};

export default Layout;
