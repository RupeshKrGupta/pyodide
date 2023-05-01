import React, { useEffect, useState } from "react";
import { json } from "stream/consumers";
import Editors from "./components/Editor";
import usePython from "./hooks/usePython";
import {
  AppContainer,
  PyodideButton,
  PyodideInput,
  PyodideInputContainer,
  PyodideInputOutputContainer,
  PyodideOutputContainer,
  PyodideText,
} from "./styledComponent";
const App = () => {
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const [argument, setArgument] = useState("");
  const [output, setOutput] = useState("");
  const {
    timeLimit,
    runPython,
    stdout,
    stderr,
    isLoading,
    finalResult,
    isRunning,
    readFile,
    writeFile,
  } = usePython();
  const handleChangeOutput = (result: any) => {
    if (timeLimit.length > 0) {
      setOutput(timeLimit);
    }
    if (result.length > 0) setOutput(result);
    // setOutput(stderr);
  };
  const handleChange = (event: any) => {
    setText(event.target.value);
  };
  const handleArguments = (event: any) => {
    setArgument(event.target.value);
  };
  const setCodeMonaco = (value: any) => {
    setCode(value);
  };

  const handleRun = async () => {
    console.log(code);
    let code_input: string[] = [];
    if (text.length > 0) {
      const myArray = text.split("\n");
      code_input = myArray;
    }
    console.log(code_input);
    let argumentArray: string[] = [];
    if (argument.length > 0) {
      const myArray = argument.split("\n");
      argumentArray = myArray;
    }
    await runPython(code, code_input, argumentArray, handleChangeOutput);
    console.log("interuupting");
    console.log(stdout);
    handleChangeOutput(stdout);
    if (stderr) handleChangeOutput(stderr);
  };
  const arraysEqual = (a1: any) => {
    console.log(JSON.stringify(a1));
    return JSON.stringify(a1) === "Pen\nBook\n\n5\n4\n";
  };
  const handleOther = async (
    code: string,
    codeInput: any,
    argumentArray: any,
    handleChangeOutput: (result: any) => void,
    codeOutput: any
  ) => {
    console.log(performance.now() / 1000 + "s");
    await runPython(code, codeInput, argumentArray, handleChangeOutput);
    if (arraysEqual(stdout)) console.log("equal");
    else console.log("not equal");
    if (stderr) return stderr;
    return stdout;
  };
  const handleSumbit = async () => {
    //file check
    // console.log("hello");
    // const data = "hello world!";
    // await writeFile("/hello.txt", data);
    // console.log(data);
    // const file = readFile("/hello.txt");
    // console.log(file);
    const results = [];
    let argumentArray: string[] = [];
    if (argument.length > 0) {
      const myArray = argument.split("\n");
      argumentArray = myArray;
    }
    const codeInput = [
      ["a", "Pen"],
      ["ababbbabbababa", "5"],
      ["aaa", "5"],
    ];
    const codeOutput = [
      ["Pen", "Book"],
      ["5", "4"],
    ];
    const startTime = performance.now();
    for (let i = 0; i < codeInput.length; i++) {
      results.push(
        handleOther(
          code,
          codeInput[i],
          argumentArray,
          handleChangeOutput,
          codeOutput
        )
      );
    }
    await Promise.all(results).then((values) => {
      console.log("inside all promise");
      handleChangeOutput(values[0]);
    });
    const loadTime = performance.now() - startTime;
    console.log(finalResult)
    console.log("overall " + loadTime / 1000 + "s");
  };
  return (
    <>
      <AppContainer>
        <Editors setCodeMonaco={setCodeMonaco} />
        <PyodideInputOutputContainer>
          <PyodideInputContainer>
            <PyodideText>Input</PyodideText>
            <PyodideInput
              value={text}
              onChange={handleChange}
              rows={14}
              cols={65}
            />
          </PyodideInputContainer>
          <PyodideOutputContainer>
            <PyodideText>Output</PyodideText>
            <PyodideInput value={output} rows={14} cols={65} />
          </PyodideOutputContainer>
        </PyodideInputOutputContainer>
        <PyodideText>Arguments</PyodideText>
        <PyodideInput
          value={argument}
          onChange={handleArguments}
          rows={5}
          cols={50}
        />
        <PyodideButton onClick={handleRun}>
          {isLoading === true ? "Running" : "Run"}
        </PyodideButton>
        <PyodideButton onClick={handleSumbit}>Sumbit</PyodideButton>
      </AppContainer>
    </>
  );
};
export default App;