import { createContext } from "react";
import { Packages } from "../types/Packages";

const PythonContext = createContext({
  packages: {} as Packages,
  timeout: 0,
  lazy: false,
  terminateOnCompletion: false,
});

export const suppressedMessages = ["Python initialization complete"];

interface PythonProviderProps {
  packages?: Packages;
  timeout?: number;
  lazy?: boolean;
  terminateOnCompletion?: boolean;
  // eslint-disable-next-line
  children: any;
}

function PythonProvider(props: PythonProviderProps) {
  const {
    packages = {},
    timeout = 0,
    lazy = false,
    terminateOnCompletion = false,
  } = props;

  return (
    <PythonContext.Provider
      value={{
        packages,
        timeout,
        lazy,
        terminateOnCompletion,
      }}
      {...props}
    />
  );
}

export { PythonContext, PythonProvider };
