/* eslint-disable no-restricted-globals */
import { expose } from "comlink";
importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.1/full/pyodide.js");
interface Pyodide {
  loadPackage: (packages: string[]) => Promise<void>;
  pyimport: (pkg: string) => micropip;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runPython: (code: string, namespace?: any) => Promise<void>;
  version: string;
  FS: {
    readFile: (name: string, options: unknown) => void;
    writeFile: (name: string, data: string, options: unknown) => void;
    mkdir: (name: string) => void;
    rmdir: (name: string) => void;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globals: any;
  isPyProxy: (value: unknown) => boolean;
  setStdin(options?: {
    stdin?: () => void;
    error?: boolean;
    isatty?: boolean;
    autoEOF?: boolean;
  }): void;
  setStdout(options?: { batched?: (msg: any) => void }): void;
}

interface micropip {
  install: (packages: string[]) => Promise<void>;
}

declare global {
  interface Window {
    loadPyodide: ({
      stdout,
      args,
      fullStdLib,
    }: {
      stdout?: (msg: string) => void;
      args?: string[];
      fullStdLib: boolean;
    }) => Promise<Pyodide>;
    pyodide: Pyodide;
  }
}

// Monkey patch console.log to prevent the script from outputting logs
// eslint-disable-next-line @typescript-eslint/no-empty-function
console.log = () => {};

const python = {
  async init(
    stdout: (msg: string) => void,
    onLoad: ({ version, banner }: { version: string; banner?: string }) => void,
    packages: string[][],
    argumentArray: string[]
  ) {
    console.log(self.pyodide);
    const startTime = performance.now();
    self.pyodide = await self.loadPyodide({
      args: argumentArray,
      fullStdLib: false,
    });
    const loadTime = performance.now() - startTime;
    if (packages[0].length > 0) {
      await self.pyodide.loadPackage(packages[0]);
    }
    if (packages[1].length > 0) {
      await self.pyodide.loadPackage(["micropip"]);
      const micropip = self.pyodide.pyimport("micropip");
      await micropip.install(packages[1]);
    }
    const version = self.pyodide.version;
    onLoad({ version });
    return loadTime / 1000;
  },
  async run(code: string, code_input: string[]) {
    console.log("running");
    let input: string[] = code_input;
    function createStdin() {
      let inputIndex = 0;
      function stdin() {
        if (inputIndex < input.length) {
          let character = input[inputIndex];
          inputIndex++;
          return character;
        } else {
          throw new Error("Input value is empty");
        }
      }
      return stdin;
    }
    let result = "";
    const handleOutput = (msg: string) => {
      result = result + msg + "\n";
    };
    console.log("running the code");
    await self.pyodide.globals.DISABLE_NETWORK;
    await self.pyodide.setStdin({ stdin: createStdin() });
    await self.pyodide.setStdout({ batched: (msg: any) => handleOutput(msg) });
    await self.pyodide.runPython(code);
    return result;
  },
  readFile(name: string) {
    return self.pyodide.FS.readFile(name, { encoding: "utf8" });
  },
  writeFile(name: string, data: string) {
    return self.pyodide.FS.writeFile(name, data, { encoding: "utf8" });
  },
  mkdir(name: string) {
    self.pyodide.FS.mkdir(name);
  },
  rmdir(name: string) {
    self.pyodide.FS.rmdir(name);
  },
};

expose(python);
