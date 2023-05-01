import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PythonContext } from "../providers/PythonProvider";
import { proxy, Remote, wrap } from "comlink";
import useFilesystem from "./useFilesystem";

import { Packages } from "../types/Packages";
import { PythonRunner } from "../types/Runner";

interface UsePythonProps {
  packages?: Packages;
}

export default function usePython(props?: UsePythonProps) {
  const { packages = {} } = props ?? {};

  const [isLoading, setIsLoading] = useState(false);
  const [pyodideVersion, setPyodideVersion] = useState<string | undefined>();
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [pendingCode, setPendingCode] = useState<string | undefined>();
  const [hasRun, setHasRun] = useState(false);
  const [argument, setArgument] = useState<string[]>([]);
  const [timeLimit, setTimeLimit] = useState("");
  const [finalResult,setFinalResult]=useState<any[]>([]);
  const {
    packages: globalPackages,
    timeout,
    lazy,
    terminateOnCompletion,
  } = useContext(PythonContext);

  const workerRef = useRef<Worker>();
  const runnerRef = useRef<Remote<PythonRunner>>();

  const {
    readFile,
    writeFile,
    mkdir,
    rmdir,
    watchModules,
    unwatchModules,
    watchedModules,
  } = useFilesystem({ runner: runnerRef?.current });

  const createWorker = () => {
    const worker = new Worker(
      new URL("../workers/python-worker", import.meta.url)
    );
    workerRef.current = worker;
  };

  useEffect(() => {
    if (!lazy) {
      // Spawn worker on mount
      createWorker();
    }

    // Cleanup worker on unmount
    return () => {
      cleanup();
    };
  }, []);

  const allPackages = useMemo(() => {
    const official = [
      ...new Set([
        ...(globalPackages.official ?? []),
        ...(packages.official ?? []),
      ]),
    ];
    const micropip = [
      ...new Set([
        ...(globalPackages.micropip ?? []),
        ...(packages.micropip ?? []),
      ]),
    ];
    return [official, micropip];
  }, [globalPackages, packages]);

  const isReady = !isLoading && !!pyodideVersion;

  useEffect(() => {
    if ((workerRef.current && !isReady) || argument.length > 0) {
      const init = async () => {
        try {
          setIsLoading(true);
          const runner: Remote<PythonRunner> = wrap(
            workerRef.current as Worker
          );
          runnerRef.current = runner;
          const startTime = performance.now();
          // console.log((performance as any).measureUserAgentSpecificMemory());
          runner.printMessage("Hello from main thread!").then(() => {
            console.log("Message printed in worker thread!");
          });
          const beforeMemoryUsage = (window.performance as any).memory
            .usedJSHeapSize;
          await runner
            .init(
              proxy((msg: string) => {
                console.log(msg);
                setOutput((prev) => [...prev, msg]);
              }),
              proxy(({ version }) => {
                // The runner is ready once the Pyodide version has been set
                setPyodideVersion(version);
                console.debug("Loaded pyodide version:", version);
              }),
              allPackages,
              argument
            )
            .then((message) => {
              console.log(message);
            });
          const loadTime = performance.now() - startTime;
          const afterMemoryUsage = (window.performance as any).memory
            .usedJSHeapSize;
          const pyodideMemoryUsage = afterMemoryUsage - beforeMemoryUsage;
          console.log(pyodideMemoryUsage);
          console.log("loadTime " + loadTime / 1000 + "s");
        } catch (error) {
          console.error("Error loading Pyodide:", error);
        } finally {
          setIsLoading(false);
        }
      };
      init();
    }
  }, [workerRef.current, argument.length]);

  // Immediately set stdout upon receiving new input
  useEffect(() => {
    if (output.length > 0) {
      setStdout(output.join("\n"));
    }
  }, [output]);

  // React to ready state and run delayed code if pending
  useEffect(() => {
    if (pendingCode && isReady) {
      const delayedRun = async () => {
        await runPython(pendingCode);
        setPendingCode(undefined);
      };
      delayedRun();
    }
  }, [pendingCode, isReady]);

  // React to run completion and run cleanup if worker should terminate on completion
  useEffect(() => {
    if (terminateOnCompletion && hasRun && !isRunning) {
      cleanup();
      setIsRunning(false);
      setPyodideVersion(undefined);
    }
  }, [terminateOnCompletion, hasRun, isRunning]);

  const pythonRunnerCode = `
import sys

sys.tracebacklimit = 0

import time
def sleep(seconds):
    start = now = time.time()
    while now - start < seconds:
        now = time.time()
time.sleep = sleep

def run(code, preamble=''):
    globals_ = {}
    try:
        exec(preamble, globals_)
        code = compile(code, 'code', 'exec')
        exec(code, globals_)
    except Exception:
        type_, value, tracebac = sys.exc_info()
        tracebac = tracebac.tb_next
        raise value.with_traceback(tracebac)
    finally:
        print()
`;

  // prettier-ignore
  const moduleReloadCode = (modules: Set<string>) => `
import importlib
import sys
${Array.from(modules).map((name) => `
if """${name}""" in sys.modules:
    importlib.reload(sys.modules["""${name}"""])
`).join('')}
del importlib
del sys
`

  const runPython = useCallback(
    async (
      code: string,
      code_input: string[] = [],
      argumentsArrays: string[] = [],
      handleChangeOutput: (result: any) => void = () => console.log("pressed"),
      preamble = ""
    ) => {
      // Clear stdout and stderr
      setArgument(argumentsArrays);
      setStdout("");
      setStderr("");
      setTimeLimit("");

      if (lazy && !isReady) {
        // Spawn worker and set pending code
        createWorker();
        setPendingCode(code);
        return;
      }

      code = `${pythonRunnerCode}\n\nrun(${JSON.stringify(
        code
      )}, ${JSON.stringify(preamble)})`;
      if (!isReady) {
        throw new Error("Pyodide is not loaded yet");
      }
      let timeoutTimer;
      try {
        setIsRunning(true);
        setHasRun(true);
        // Clear output
        setOutput([]);
        setFinalResult([])
        if (!isReady || !runnerRef.current) {
          throw new Error("Pyodide is not loaded yet");
        }
        console.log(timeout);
        if (timeout > 0) {
          timeoutTimer = setTimeout(() => {
            console.log(timeout);
            setStdout("");
            setStderr(`Execution timed out. Reached limit of ${timeout} ms.`);
            handleChangeOutput("Time Limit exceded");
            interruptExecution();
          }, timeout);
        }
        if (watchedModules.size > 0) {
          await runnerRef.current.run(moduleReloadCode(watchedModules));
        }
        console.log(runnerRef.current);
        const startTime = performance.now();
        console.log("coming here");
        await runnerRef.current.run(code, code_input).then((message) => {
          console.log(message);
          setFinalResult(prev=>[...prev,message]);
        });
        const loadTime = performance.now() - startTime;

        console.log("loadRunningTime " + loadTime / 1000 + "s");
        // eslint-disable-next-line
      } catch (error: any) {
        setStderr("Traceback (most recent call last):\n" + error.message);
      } finally {
        setIsRunning(false);
        clearTimeout(timeoutTimer);
      }
    },
    [lazy, isReady, timeout, watchedModules]
  );

  const interruptExecution = () => {
    setTimeLimit("Time Limit exceded");
    console.log("interrupt");
    cleanup();
    setIsRunning(false);
    setPyodideVersion(undefined);
    setOutput([]);

    // Spawn new worker
    createWorker();
  };

  const cleanup = () => {
    if (!workerRef.current) {
      return;
    }
    console.debug("Terminating worker");
    workerRef.current.terminate();
  };

  return {
    timeLimit,
    runPython,
    stdout,
    stderr,
    isLoading,
    isReady,
    isRunning,
    interruptExecution,
    readFile,
    writeFile,
    mkdir,
    rmdir,
    watchModules,
    unwatchModules,
    finalResult
  };
}
