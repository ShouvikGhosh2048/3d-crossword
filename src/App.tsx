import { OrbitControls } from "@react-three/drei";
import { Text, TransformControls } from "@react-three/drei/core";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useReducer, useRef, useState } from "react";
import { FaArrowLeft, FaFolderOpen, FaTrash } from "react-icons/fa";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import { z } from "zod";

// https://stackoverflow.com/a/37193954
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#using_the_download_attribute_to_save_a_canvas_as_a_png
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#examples
// https://stackoverflow.com/a/66590179
// https://stackoverflow.com/a/74759542
// https://stackoverflow.com/a/46176359

const BLOCK_COLOR = "rgb(200, 200, 200)";
const SELECTED_BLOCK_COLOR = "rgb(150, 150, 230)";

function onlyContainsUpperCaseAlphabetsAndSpaces(s: string) {
  for (let i = 0; i < s.length; i++) {
    if (
      ("A".charCodeAt(0) > s.charCodeAt(i) ||
        s.charCodeAt(i) > "Z".charCodeAt(0)) &&
      s[i] !== " "
    ) {
      return false;
    }
  }
  return true;
}

function wordLetterPosition(
  start: [number, number, number],
  direction: "X" | "Y" | "Z",
  index: number
): [number, number, number] {
  switch (direction) {
    case "X": {
      return [start[0] + index, start[1], start[2]];
    }
    case "Y": {
      return [start[0], start[1] - index, start[2]];
    }
    case "Z": {
      return [start[0], start[1], start[2] + index];
    }
  }
}

interface LetterBlockProps {
  position: [number, number, number];
  letter: string;
  textColor: string;
  color: string;
  opacity: number;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}

function LetterBlock({
  position,
  letter,
  textColor,
  color,
  opacity,
  onClick,
}: LetterBlockProps) {
  // The 0.51 is used so that the letter lies slightly outside the cube and thus is visible.
  // The 0.05 is used to center the letters.
  let letterPositionsAndRotations: [
    [number, number, number],
    [number, number, number]
  ][] = [
    [
      [position[0], position[1] - 0.05, position[2] + 0.51],
      [0, 0, 0],
    ],
    [
      [position[0] + 0.51, position[1] - 0.05, position[2]],
      [0, Math.PI / 2, 0],
    ],
    [
      [position[0], position[1] - 0.05, position[2] - 0.51],
      [0, Math.PI, 0],
    ],
    [
      [position[0] - 0.51, position[1] - 0.05, position[2]],
      [0, (3 * Math.PI) / 2, 0],
    ],
    [
      [position[0], position[1] - 0.51, position[2] - 0.05],
      [Math.PI / 2, 0, 0],
    ],
    [
      [position[0], position[1] + 0.51, position[2] + 0.05],
      [(3 * Math.PI) / 2, 0, 0],
    ],
  ];

  return (
    <>
      {letterPositionsAndRotations.map(([position, rotation], index) => (
        <Text
          position={position}
          rotation={rotation}
          color={textColor}
          fillOpacity={opacity}
          anchorY="middle"
          key={index}
        >
          {letter}
        </Text>
      ))}
      <mesh position={position} onClick={onClick}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={color}
          transparent={true}
          opacity={opacity}
        />
      </mesh>
    </>
  );
}

type Word = {
  word: string;
  direction: "X" | "Y" | "Z";
  start: [number, number, number];
  description: string;
};

type Crossword = {
  name: string;
  words: Word[];
};

const EXAMPLE_CROSSWORD: Crossword = {
  name: "Example",
  words: [
    {
      word: "HELLO",
      direction: "X",
      start: [0, 0, 0],
      description: "Greeting",
    },
    {
      word: "WORLD",
      direction: "Y",
      start: [4, 1, 0],
      description: "Earth",
    },
  ],
};

const crosswordSchema = z.object({
  name: z.string().min(1),
  words: z
    .object({
      word: z.string().min(1),
      direction: z.enum(["X", "Y", "Z"]),
      start: z.number().int().array().length(3),
      description: z.string().min(1),
    })
    .array(),
});

interface OpenCrosswordProps {
  onOpen: (crossword: Crossword) => void;
}

function OpenCrossword({ onOpen }: OpenCrosswordProps) {
  let [fileError, setFileError] = useState("");

  return (
    <div>
      <input
        type="file"
        className="mb-1"
        onChange={(e) => {
          let fileInput = e.target as HTMLInputElement;
          if (fileInput.files && fileInput.files.length > 0) {
            let file = fileInput.files[0];
            file
              .text()
              .then((text) => {
                try {
                  let crossword = crosswordSchema.parse(
                    JSON.parse(text)
                  ) as Crossword;

                  // Check whether the crossword is valid.
                  let letters = new Map();
                  for (const { word, direction, start } of crossword.words) {
                    for (let i = 0; i < word.length; i++) {
                      if (
                        word[i].charCodeAt(i) < "A".charCodeAt(0) ||
                        word[i].charCodeAt(i) > "Z".charCodeAt(0)
                      ) {
                        // Not an uppercase alphabet.
                        setFileError("Invalid crossword");
                        return;
                      }

                      let position = wordLetterPosition(start, direction, i);
                      let positionKey = `${position[0]} ${position[1]} ${position[2]}`;

                      let entry = letters.get(positionKey);
                      if (entry === undefined) {
                        letters.set(positionKey, word[i]);
                      } else if (entry !== word[i]) {
                        setFileError("Invalid crossword");
                        return;
                      }
                    }
                  }

                  setFileError("");
                  onOpen(crossword);
                } catch (err) {
                  setFileError("Invalid file");
                }
              })
              .catch((_) => setFileError("Couldn't open the file"));
          } else {
            setFileError("");
          }
        }}
      />
      <span className="text-red-700">{fileError}</span>
    </div>
  );
}

interface IntegerInputProps {
  value: number;
  onValueChange: (value: number) => void;
}

function IntegerInput({ value, onValueChange }: IntegerInputProps) {
  // We need a seperate inputValue as we want to allow '' and '-' in the input while typing.
  let [inputValue, setInputValue] = useState(value.toString());
  if (value !== Number(inputValue)) {
    setInputValue(value.toString());
  }

  return (
    <input
      className="w-9 border border-slate-300"
      type="number"
      value={inputValue}
      onChange={(e) => {
        let number = Number(e.target.value);
        if (Math.floor(number) === number) {
          setInputValue(e.target.value);
          onValueChange(number);
        }
      }}
      step="1"
    />
  );
}

interface WordPositionControlsProps {
  orbitCenter: [number, number, number];
  dispatch: React.Dispatch<CreateCrosswordAction>;
}

// When TransformControls is rerendered, the current dragging is stopped.
// To prevent this we use memo.
const WordPositionControls = memo(function ({
  orbitCenter,
  dispatch,
}: WordPositionControlsProps) {
  let transformControlsRef = useRef(null);
  return (
    <TransformControls
      position={orbitCenter}
      translationSnap={1}
      ref={transformControlsRef}
      onObjectChange={() => {
        let transformControls = transformControlsRef.current as any;
        dispatch({
          type: "Drag",
          center: [
            transformControls.worldPosition.x,
            transformControls.worldPosition.y,
            transformControls.worldPosition.z,
          ],
        });
      }}
      onMouseUp={() => {
        let transformControls = transformControlsRef.current as any;
        let newPosition = [
          transformControls.worldPosition.x,
          transformControls.worldPosition.y,
          transformControls.worldPosition.z,
        ] as [number, number, number];
        dispatch({
          type: "DragEnd",
          center: [
            transformControls.worldPosition.x,
            transformControls.worldPosition.y,
            transformControls.worldPosition.z,
          ],
        });
      }}
    >
      <mesh></mesh>
    </TransformControls>
  );
});

interface CreateCrosswordMenuProps {
  createCrosswordState: CreateCrosswordState;
  dispatch: React.Dispatch<CreateCrosswordAction>;
  letters: Map<
    string,
    {
      letter: string;
      position: [number, number, number];
      opacity: number;
      lettersBy: number[];
    }
  >;
}

function CreateCrosswordMenu({
  createCrosswordState,
  dispatch,
  letters,
}: CreateCrosswordMenuProps) {
  let [showOpenCrossword, setShowOpenCrossword] = useState(false);
  let {
    crossword: { name, words },
    currentWordIndex,
  } = createCrosswordState;
  let wordValidity: boolean[] = new Array(words.length).fill(true);
  for (let i = 0; i < words.length; i++) {
    if (words[i].description.length === 0) {
      wordValidity[i] = false;
      continue;
    }

    if (words[i].word.length === 0) {
      wordValidity[i] = false;
      continue;
    }

    for (let j = 0; j < words[i].word.length; j++) {
      if (words[i].word[j] === " ") {
        wordValidity[i] = false;
        break;
      }
    }
  }
  for (const { letter, lettersBy } of letters.values()) {
    if (letter === "?") {
      lettersBy.forEach((i: number) => {
        wordValidity[i] = false;
      });
    }
  }

  let allowSave = true;
  for (let i = 0; i < words.length; i++) {
    if (!wordValidity[i]) {
      allowSave = false;
      break;
    }
  }
  if (name.length === 0 || words.length === 0) {
    allowSave = false;
  }

  return (
    <div className="border-r p-3 space-y-3 w-60">
      <div className="border-b pb-3">
        {!showOpenCrossword && (
          <button
            onClick={() => {
              setShowOpenCrossword(true);
            }}
          >
            <span className="flex gap-2 items-center">
              <FaFolderOpen /> Open crossword to edit
            </span>
          </button>
        )}
        {showOpenCrossword && (
          <>
            <div className="border-b pb-3">
              <p className="mb-1">Open file to edit: </p>
              <OpenCrossword
                onOpen={(crossword) => {
                  dispatch({
                    type: "SetCrossword",
                    crossword,
                  });
                }}
              />
            </div>
            <div className="pt-3">
              <button
                onClick={() => {
                  setShowOpenCrossword(false);
                  dispatch({
                    type: "SetCrossword",
                    crossword: {
                      name: "",
                      words: [],
                    },
                  });
                }}
              >
                + New crossword
              </button>
            </div>
          </>
        )}
      </div>
      <input
        value={name}
        onChange={(e) => {
          dispatch({
            type: "SetName",
            name: e.target.value,
          });
        }}
        placeholder="Name"
        className="border border-slate-300 mb-3 p-0.5"
      />
      {currentWordIndex === null && (
        <>
          <div className="flex justify-between mb-3">
            <span>Words:</span>
            <button
              onClick={() => {
                dispatch({
                  type: "NewWord",
                });
              }}
            >
              + New word
            </button>
          </div>
          <div className="space-y-1">
            {words.map((word, index) => (
              <div className="flex justify-between" key={index}>
                <button
                  className={
                    "mr-3 text-ellipsis overflow-hidden " +
                    (wordValidity[index] ? "" : "text-red-700")
                  }
                  onClick={() => {
                    dispatch({
                      type: "SelectWord",
                      index,
                    });
                  }}
                >
                  {word.word.length > 0 ? word.word.replaceAll(" ", "_") : "_"}
                </button>
                <button
                  onClick={() => {
                    dispatch({
                      type: "DeleteWord",
                      index,
                    });
                  }}
                >
                  <FaTrash />
                </button>
              </div>
            ))}
          </div>
          {allowSave && (
            <div className="flex justify-center">
              <a
                onClick={(e) => {
                  const file = new File(
                    [
                      JSON.stringify({
                        name,
                        words,
                      }),
                    ],
                    `${name}.json`,
                    {
                      type: "application/json",
                    }
                  );
                  let link = e.target as HTMLAnchorElement;
                  link.href = URL.createObjectURL(file);
                }}
                download={`${name}.json`}
                className="cursor-pointer underline"
              >
                Save crossword
              </a>
            </div>
          )}
        </>
      )}
      {currentWordIndex !== null && (
        <>
          <div className="my-3 flex items-center gap-1">
            <button
              onClick={() => {
                dispatch({
                  type: "ShowWordList",
                });
              }}
            >
              <span className="flex gap-1 items-center">
                <FaArrowLeft />
                <span>Back to words</span>
              </span>
            </button>
          </div>
          <div>
            <p>Direction:</p>
            <div className="flex gap-3 mb-3">
              {["X", "Y", "Z"].map((direction) => (
                <span key={direction}>
                  <input
                    type="radio"
                    name="direction"
                    id={direction}
                    value={direction}
                    className="cursor-pointer"
                    onChange={(e) => {
                      if (e.target.checked) {
                        dispatch({
                          type: "SetDirection",
                          direction: direction as "X" | "Y" | "Z",
                        });
                      }
                    }}
                    checked={
                      direction === words[currentWordIndex as number].direction
                    }
                  />
                  <label htmlFor={direction} className="cursor-pointer">
                    {direction}
                  </label>
                </span>
              ))}
            </div>
          </div>
          <div>
            <p>Start:</p>
            <div className="flex gap-3 mb-3">
              {["X", "Y", "Z"].map((dimension, i) => (
                <div className="flex gap-2" key={i}>
                  <label>{dimension}:</label>
                  <IntegerInput
                    value={words[currentWordIndex as number].start[i]}
                    onValueChange={(value) => {
                      let currentWord = words[currentWordIndex as number];
                      let newStart = [
                        ...currentWord.start.slice(0, i),
                        value,
                        ...currentWord.start.slice(i + 1),
                      ] as [number, number, number];
                      dispatch({
                        type: "SetStart",
                        position: newStart,
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p>Word:</p>
            <input
              value={words[currentWordIndex as number].word}
              className="border border-slate-300"
              onChange={(e) => {
                let word = e.target.value.toUpperCase();
                if (onlyContainsUpperCaseAlphabetsAndSpaces(word)) {
                  dispatch({
                    type: "SetWord",
                    word,
                  });
                }
              }}
            />
          </div>
          <div>
            <p>Description:</p>
            <textarea
              value={words[currentWordIndex as number].description}
              onChange={(e) => {
                dispatch({
                  type: "SetDescription",
                  description: e.target.value,
                });
              }}
              className="border border-slate-300"
            ></textarea>
          </div>
        </>
      )}
    </div>
  );
}

function Navbar() {
  return (
    <div className="p-2 flex justify-between bg-black text-white">
      <Link to="/">3D crossword</Link>
      <div className="flex gap-5">
        <Link to="/">Solve</Link>
        <Link to="/create">Create</Link>
      </div>
    </div>
  );
}

type CreateCrosswordAction =
  | {
      type: "SetCrossword";
      crossword: Crossword;
    }
  | {
      type: "SetName";
      name: string;
    }
  | {
      type: "NewWord";
    }
  | {
      type: "SelectWord";
      index: number;
    }
  | {
      type: "DeleteWord";
      index: number;
    }
  | {
      type: "SetOrbitCenter";
      position: [number, number, number];
    }
  | {
      type: "ShowWordList";
    }
  | {
      type: "SetStart";
      position: [number, number, number];
    }
  | {
      type: "SetDirection";
      direction: "X" | "Y" | "Z";
    }
  | {
      type: "SetWord";
      word: string;
    }
  | {
      type: "SetDescription";
      description: string;
    }
  | {
      type: "Drag";
      center: [number, number, number];
    }
  | {
      type: "DragEnd";
      center: [number, number, number];
    }
  | {
      type: "Undo";
    }
  | {
      type: "Redo";
    };

type WordsChange =
  | {
      type: "NewWord";
    }
  | {
      type: "DeleteWord";
      index: number;
      word: Word;
    }
  | {
      type: "ChangeStart";
      start: [number, number, number];
      previousStart: [number, number, number];
    }
  | {
      type: "ChangeDirection";
      direction: "X" | "Y" | "Z";
      previousDirection: "X" | "Y" | "Z";
    }
  | {
      type: "ChangeWord";
      word: string;
      previousWord: string;
    }
  | {
      type: "ChangeDescription";
      description: string;
      previousDescription: string;
    };

interface History {
  currentWordIndex: null | number;
  orbitCenter: [number, number, number];
  crossword: {
    name: string;
    // We store the change from the previous value to the next instead of the entire words.
    wordsChange: null | WordsChange;
  };
}

interface CreateCrosswordState {
  crossword: Crossword;
  currentWordIndex: null | number;
  orbitCenter: [number, number, number];
  history: History[];
  historyIndex: number;
}

function createCrosswordReducer(
  state: CreateCrosswordState,
  action: CreateCrosswordAction
): CreateCrosswordState {
  let {
    crossword: { name, words },
    currentWordIndex,
    orbitCenter,
    history,
    historyIndex,
  } = state;
  switch (action.type) {
    case "SetCrossword": {
      return {
        crossword: action.crossword,
        orbitCenter: [0, 0, 0],
        currentWordIndex: null,
        history: [
          {
            crossword: {
              name: action.crossword.name,
              wordsChange: null,
            },
            currentWordIndex: null,
            orbitCenter: [0, 0, 0],
          },
        ],
        historyIndex: 0,
      };
    }
    case "SetName": {
      return {
        ...state,
        crossword: {
          name: action.name,
          words,
        },
        history: [
          ...history.slice(0, historyIndex + 1),
          {
            crossword: {
              name: action.name,
              wordsChange: null,
            },
            currentWordIndex,
            orbitCenter,
          },
        ],
        historyIndex: historyIndex + 1,
      };
    }
    case "NewWord": {
      let newWordIndex = words.length;
      let newCrossword = {
        name,
        words: [
          ...words,
          {
            word: "",
            direction: "X" as "X" | "Y" | "Z",
            start: orbitCenter,
            description: "",
          },
        ],
      };
      return {
        ...state,
        currentWordIndex: newWordIndex,
        crossword: newCrossword,
        history: [
          ...history.slice(0, historyIndex + 1),
          {
            crossword: {
              name,
              wordsChange: {
                type: "NewWord",
              },
            },
            currentWordIndex: newWordIndex,
            orbitCenter,
          },
        ],
        historyIndex: historyIndex + 1,
      };
    }
    case "SelectWord": {
      let { start, direction, word } = words[action.index];
      let centerBlockIndex = Math.floor(word.length / 2);
      let centerBlockPosition = wordLetterPosition(
        start,
        direction,
        centerBlockIndex
      );
      return {
        ...state,
        currentWordIndex: action.index,
        orbitCenter: centerBlockPosition,
        history: [
          ...history.slice(0, historyIndex + 1),
          {
            crossword: {
              name,
              wordsChange: null,
            },
            currentWordIndex: action.index,
            orbitCenter: centerBlockPosition,
          },
        ],
        historyIndex: historyIndex + 1,
      };
    }
    case "DeleteWord": {
      // Check if the orbit center still has a letter block after deleting the word,
      // if not reset the orbit center to [0, 0, 0].
      let orbitCenterHasBlock = false;
      for (let i = 0; i < words.length; i++) {
        if (i === action.index) {
          continue;
        }

        let { start, direction, word } = words[i];
        let endBlock = wordLetterPosition(start, direction, word.length - 1);

        orbitCenterHasBlock = true;
        for (let i = 0; i < 3; i++) {
          if (
            !(
              (start[i] <= orbitCenter[i] && orbitCenter[i] <= endBlock[i]) ||
              (start[i] >= orbitCenter[i] && orbitCenter[i] >= endBlock[i])
            )
          ) {
            orbitCenterHasBlock = false;
          }
        }

        if (orbitCenterHasBlock) {
          break;
        }
      }

      let newOrbitCenter = orbitCenter;
      if (!orbitCenterHasBlock) {
        newOrbitCenter = [0, 0, 0];
      }

      let newCrossword = {
        name,
        words: [
          ...words.slice(0, action.index),
          ...words.slice(action.index + 1),
        ],
      };
      return {
        ...state,
        orbitCenter: newOrbitCenter,
        crossword: newCrossword,
        history: [
          ...history.slice(0, historyIndex + 1),
          {
            crossword: {
              name,
              wordsChange: {
                type: "DeleteWord",
                word: words[action.index],
                index: action.index,
              },
            },
            currentWordIndex,
            orbitCenter: newOrbitCenter,
          },
        ],
        historyIndex: historyIndex + 1,
      };
    }
    case "SetOrbitCenter": {
      return {
        ...state,
        orbitCenter: action.position,
      };
    }
    case "ShowWordList": {
      return {
        ...state,
        currentWordIndex: null,
        history: [
          ...history.slice(0, historyIndex + 1),
          {
            crossword: {
              name,
              wordsChange: null,
            },
            currentWordIndex: null,
            orbitCenter,
          },
        ],
        historyIndex: historyIndex + 1,
      };
    }
    case "SetStart": {
      let currentWord = words[currentWordIndex as number];
      let { direction, word, start } = currentWord;
      let newOrbitCenter = wordLetterPosition(
        action.position,
        direction,
        Math.floor(word.length / 2)
      );
      let newWords = [
        ...words.slice(0, currentWordIndex as number),
        {
          ...currentWord,
          start: action.position,
        },
        ...words.slice((currentWordIndex as number) + 1),
      ];
      return {
        ...state,
        orbitCenter: newOrbitCenter,
        crossword: {
          name,
          words: newWords,
        },
        history: [
          ...history.slice(0, historyIndex + 1),
          {
            crossword: {
              name,
              wordsChange: {
                type: "ChangeStart",
                start: action.position,
                previousStart: start,
              },
            },
            currentWordIndex,
            orbitCenter: newOrbitCenter,
          },
        ],
        historyIndex: historyIndex + 1,
      };
    }
    case "SetDirection": {
      let currentWord = words[currentWordIndex as number];
      let { direction, word, start } = currentWord;
      let newOrbitCenter = wordLetterPosition(
        start,
        action.direction,
        Math.floor(word.length / 2)
      );
      let newWords = [
        ...words.slice(0, currentWordIndex as number),
        {
          ...currentWord,
          direction: action.direction,
        },
        ...words.slice((currentWordIndex as number) + 1),
      ];
      return {
        ...state,
        orbitCenter: newOrbitCenter,
        crossword: {
          name,
          words: newWords,
        },
        history: [
          ...history.slice(0, historyIndex + 1),
          {
            crossword: {
              name,
              wordsChange: {
                type: "ChangeDirection",
                direction: action.direction,
                previousDirection: direction,
              },
            },
            currentWordIndex,
            orbitCenter: newOrbitCenter,
          },
        ],
        historyIndex: historyIndex + 1,
      };
    }
    case "SetWord": {
      let currentWord = words[currentWordIndex as number];
      let { start, direction, word } = currentWord;
      let newOrbitCenter = wordLetterPosition(
        start,
        direction,
        Math.floor(action.word.length / 2)
      );
      let newWords = [
        ...words.slice(0, currentWordIndex as number),
        {
          ...currentWord,
          word: action.word,
        },
        ...words.slice((currentWordIndex as number) + 1),
      ];
      return {
        ...state,
        orbitCenter: newOrbitCenter,
        crossword: {
          name,
          words: newWords,
        },
        history: [
          ...history.slice(0, historyIndex + 1),
          {
            crossword: {
              name,
              wordsChange: {
                type: "ChangeWord",
                word: action.word,
                previousWord: word,
              },
            },
            currentWordIndex,
            orbitCenter: newOrbitCenter,
          },
        ],
        historyIndex: historyIndex + 1,
      };
    }
    case "SetDescription": {
      let currentWord = words[currentWordIndex as number];
      let newWords = [
        ...words.slice(0, currentWordIndex as number),
        {
          ...currentWord,
          description: action.description,
        },
        ...words.slice((currentWordIndex as number) + 1),
      ];
      return {
        ...state,
        crossword: {
          name,
          words: newWords,
        },
        history: [
          ...history.slice(0, historyIndex + 1),
          {
            crossword: {
              name,
              wordsChange: {
                type: "ChangeDescription",
                description: action.description,
                previousDescription: currentWord.description,
              },
            },
            currentWordIndex,
            orbitCenter,
          },
        ],
        historyIndex: historyIndex + 1,
      };
    }
    case "Drag": {
      let currentWord = words[currentWordIndex as number];
      let { direction, word } = currentWord;
      let newStart = wordLetterPosition(
        action.center,
        direction,
        -Math.floor(word.length / 2)
      );
      let newCrossword = {
        ...state.crossword,
        words: [
          ...words.slice(0, currentWordIndex as number),
          {
            ...currentWord,
            start: newStart,
          },
          ...words.slice((currentWordIndex as number) + 1),
        ],
      };
      return {
        ...state,
        crossword: newCrossword,
      };
    }
    case "DragEnd": {
      let currentWord = words[currentWordIndex as number];
      let { direction, word } = currentWord;
      let previousStart = wordLetterPosition(
        orbitCenter,
        direction,
        -Math.floor(word.length / 2)
      );
      let newStart = wordLetterPosition(
        action.center,
        direction,
        -Math.floor(word.length / 2)
      );
      let newCrossword = {
        ...state.crossword,
        words: [
          ...words.slice(0, currentWordIndex as number),
          {
            ...currentWord,
            start: newStart,
          },
          ...words.slice((currentWordIndex as number) + 1),
        ],
      };
      return {
        ...state,
        orbitCenter: action.center,
        crossword: newCrossword,
        history: [
          ...history.slice(0, historyIndex + 1),
          {
            crossword: {
              name,
              wordsChange: {
                type: "ChangeStart",
                start: newStart,
                previousStart,
              },
            },
            currentWordIndex,
            orbitCenter: action.center,
          },
        ],
        historyIndex: historyIndex + 1,
      };
    }
    case "Undo": {
      if (historyIndex === 0) {
        return state;
      }

      let {
        currentWordIndex,
        orbitCenter,
        crossword: { name },
      } = history[historyIndex - 1];
      let wordsChange = history[historyIndex].crossword.wordsChange;
      let newWords = words;
      if (wordsChange) {
        switch (wordsChange.type) {
          case "NewWord": {
            newWords = newWords.slice(0, newWords.length - 1);
            break;
          }
          case "DeleteWord": {
            newWords = [
              ...newWords.slice(0, wordsChange.index),
              wordsChange.word,
              ...newWords.slice(wordsChange.index),
            ];
            break;
          }
          case "ChangeStart": {
            newWords = [
              ...newWords.slice(
                0,
                history[historyIndex].currentWordIndex as number
              ),
              {
                ...newWords[history[historyIndex].currentWordIndex as number],
                start: wordsChange.previousStart,
              },
              ...newWords.slice(
                (history[historyIndex].currentWordIndex as number) + 1
              ),
            ];
            break;
          }
          case "ChangeDirection": {
            newWords = [
              ...newWords.slice(
                0,
                history[historyIndex].currentWordIndex as number
              ),
              {
                ...newWords[history[historyIndex].currentWordIndex as number],
                direction: wordsChange.previousDirection,
              },
              ...newWords.slice(
                (history[historyIndex].currentWordIndex as number) + 1
              ),
            ];
            break;
          }
          case "ChangeWord": {
            newWords = [
              ...newWords.slice(
                0,
                history[historyIndex].currentWordIndex as number
              ),
              {
                ...newWords[history[historyIndex].currentWordIndex as number],
                word: wordsChange.previousWord,
              },
              ...newWords.slice(
                (history[historyIndex].currentWordIndex as number) + 1
              ),
            ];
            break;
          }
          case "ChangeDescription": {
            newWords = [
              ...newWords.slice(
                0,
                history[historyIndex].currentWordIndex as number
              ),
              {
                ...newWords[history[historyIndex].currentWordIndex as number],
                description: wordsChange.previousDescription,
              },
              ...newWords.slice(
                (history[historyIndex].currentWordIndex as number) + 1
              ),
            ];
            break;
          }
        }
      }

      return {
        history,
        historyIndex: historyIndex - 1,
        currentWordIndex,
        orbitCenter,
        crossword: {
          name,
          words: newWords,
        },
      };
    }
    case "Redo": {
      if (historyIndex === history.length - 1) {
        return state;
      }

      let {
        currentWordIndex,
        orbitCenter,
        crossword: { name, wordsChange },
      } = history[historyIndex + 1];
      let newWords = words;
      if (wordsChange) {
        switch (wordsChange.type) {
          case "NewWord": {
            newWords = [
              ...newWords,
              {
                word: "",
                description: "",
                direction: "X",
                start: orbitCenter,
              },
            ];
            break;
          }
          case "DeleteWord": {
            newWords = [
              ...newWords.slice(0, wordsChange.index),
              ...newWords.slice(wordsChange.index + 1),
            ];
            break;
          }
          case "ChangeStart": {
            newWords = [
              ...newWords.slice(0, currentWordIndex as number),
              {
                ...newWords[currentWordIndex as number],
                start: wordsChange.start,
              },
              ...newWords.slice((currentWordIndex as number) + 1),
            ];
            break;
          }
          case "ChangeDirection": {
            newWords = [
              ...newWords.slice(0, currentWordIndex as number),
              {
                ...newWords[currentWordIndex as number],
                direction: wordsChange.direction,
              },
              ...newWords.slice((currentWordIndex as number) + 1),
            ];
            break;
          }
          case "ChangeWord": {
            newWords = [
              ...newWords.slice(0, currentWordIndex as number),
              {
                ...newWords[currentWordIndex as number],
                word: wordsChange.word,
              },
              ...newWords.slice((currentWordIndex as number) + 1),
            ];
            break;
          }
          case "ChangeDescription": {
            newWords = [
              ...newWords.slice(0, currentWordIndex as number),
              {
                ...newWords[currentWordIndex as number],
                description: wordsChange.description,
              },
              ...newWords.slice((currentWordIndex as number) + 1),
            ];
            break;
          }
        }
      }

      return {
        history,
        historyIndex: historyIndex + 1,
        currentWordIndex,
        orbitCenter,
        crossword: {
          name,
          words: newWords,
        },
      };
    }
  }
}

function CreateCrossword() {
  let [state, dispatch] = useReducer(createCrosswordReducer, {
    crossword: {
      name: "",
      words: [],
    },
    currentWordIndex: null,
    orbitCenter: [0, 0, 0],
    history: [
      {
        crossword: {
          name: "",
          wordsChange: null,
        },
        currentWordIndex: null,
        orbitCenter: [0, 0, 0],
      },
    ],
    historyIndex: 0,
  });
  let {
    crossword: { words },
    currentWordIndex,
    orbitCenter,
  } = state;

  useEffect(() => {
    document.title = "Create crossword";
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey) {
        if (e.code === "KeyZ") {
          // https://stackoverflow.com/a/39802212
          e.preventDefault();
          dispatch({
            type: "Undo",
          });
        } else if (e.code === "KeyY") {
          e.preventDefault();
          dispatch({
            type: "Redo",
          });
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  let letters: Map<
    string,
    {
      letter: string;
      position: [number, number, number];
      opacity: number;
      lettersBy: number[];
    }
  > = new Map();
  words.forEach(({ word, direction, start }, wordIndex) => {
    for (let i = 0; i < word.length; i++) {
      let position = wordLetterPosition(start, direction, i);
      let positionKey = `${position[0]} ${position[1]} ${position[2]}`;

      let entry = letters.get(positionKey);
      if (entry === undefined) {
        // No entry for this position.
        letters.set(positionKey, {
          letter: word[i],
          position,
          opacity:
            currentWordIndex === null || currentWordIndex === wordIndex
              ? 1.0
              : 0.1,
          lettersBy: [wordIndex],
        });
      } else if (entry.letter === " ") {
        // Entry exists but is a space so we can put our letter.
        letters.set(positionKey, {
          letter: word[i],
          position,
          opacity: Math.max(
            currentWordIndex === null || currentWordIndex === wordIndex
              ? 1.0
              : 0.1,
            entry.opacity
          ), // We use max as if the block is required to have opacity 1 by some word, we keep the opacity as 1.
          lettersBy: [...entry.lettersBy, wordIndex],
        });
      } else if (word[i] === " " || entry.letter === word[i]) {
        // Either our letter is a space or it is equal to the current letter, so we can just keep the letter already present.
        letters.set(positionKey, {
          letter: entry.letter,
          position,
          opacity: Math.max(
            currentWordIndex === null || currentWordIndex === wordIndex
              ? 1.0
              : 0.1,
            entry.opacity
          ),
          lettersBy: [...entry.lettersBy, wordIndex],
        });
      } else {
        // The letters don't match.
        letters.set(positionKey, {
          letter: "?",
          position,
          opacity: Math.max(
            currentWordIndex === null || currentWordIndex === wordIndex
              ? 1.0
              : 0.1,
            entry.opacity
          ),
          lettersBy: [...entry.lettersBy, wordIndex],
        });
      }
    }
  });

  let blocks = [];
  for (const { letter, position, opacity } of letters.values()) {
    let positionKey = `${position[0]} ${position[1]} ${position[2]}`;

    let isOrbitCenter = true;
    for (let i = 0; i < 3; i++) {
      if (position[i] !== orbitCenter[i]) {
        isOrbitCenter = false;
        break;
      }
    }

    let onClick = (e: ThreeEvent<MouseEvent>) => {
      if (currentWordIndex === null) {
        e.stopPropagation();
        dispatch({
          type: "SetOrbitCenter",
          position,
        });
      }
    };

    blocks.push(
      <LetterBlock
        position={position}
        letter={letter}
        textColor={letter === "?" ? "red" : "black"}
        opacity={opacity}
        key={positionKey}
        color={
          isOrbitCenter && currentWordIndex === null
            ? SELECTED_BLOCK_COLOR
            : BLOCK_COLOR
        }
        onClick={onClick}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="grow flex justify-between">
        <CreateCrosswordMenu
          createCrosswordState={state}
          dispatch={dispatch}
          letters={letters}
        />
        <div className="grow flex justify-center items-center bg-gray-300">
          <div className="h-5/6 w-11/12 bg-white">
            <Canvas>
              <ambientLight />
              <pointLight position={[10, 10, 10]} />
              {blocks}
              {currentWordIndex !== null &&
                words[currentWordIndex].word.length > 0 && (
                  <WordPositionControls
                    orbitCenter={orbitCenter}
                    dispatch={dispatch}
                  />
                )}
              <OrbitControls target={orbitCenter} makeDefault />
            </Canvas>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ViewCrosswordProps {
  crossword: Crossword;
  words: string[];
  currentWordIndex: number | null;
  orbitCenter: [number, number, number];
  setOrbitCenter: (orbitCenter: [number, number, number]) => void;
}

function ViewCrossword({
  crossword,
  words,
  currentWordIndex,
  orbitCenter,
  setOrbitCenter,
}: ViewCrosswordProps) {
  let letters = new Map();
  crossword.words.forEach(({ word, direction, start }, wordIndex) => {
    for (let i = 0; i < word.length; i++) {
      let position = wordLetterPosition(start, direction, i);
      let positionKey = `${position[0]} ${position[1]} ${position[2]}`;

      let entry = letters.get(positionKey);
      let opacity =
        currentWordIndex === null || currentWordIndex === wordIndex ? 1.0 : 0.1;
      if (entry !== undefined) {
        opacity = Math.max(opacity, entry.opacity);
      }

      letters.set(positionKey, {
        letter: " ",
        position,
        opacity,
        lettersBy: [],
      });
    }
  });

  words.forEach((word, wordIndex) => {
    let { direction, start } = crossword.words[wordIndex];
    for (let i = 0; i < word.length; i++) {
      let position = wordLetterPosition(start, direction, i);
      let positionKey = `${position[0]} ${position[1]} ${position[2]}`;

      let entry = letters.get(positionKey);
      if (entry.letter === " ") {
        letters.set(positionKey, {
          letter: word[i],
          position,
          opacity: Math.max(
            currentWordIndex === null || currentWordIndex === wordIndex
              ? 1.0
              : 0.1,
            entry.opacity
          ),
          lettersBy: [...entry.lettersBy, wordIndex],
        });
      } else if (word[i] === " " || entry.letter === word[i]) {
        letters.set(positionKey, {
          letter: entry.letter,
          position,
          opacity: Math.max(
            currentWordIndex === null || currentWordIndex === wordIndex
              ? 1.0
              : 0.1,
            entry.opacity
          ),
          lettersBy: [...entry.lettersBy, wordIndex],
        });
      } else {
        letters.set(positionKey, {
          letter: "?",
          position,
          opacity: Math.max(
            currentWordIndex === null || currentWordIndex === wordIndex
              ? 1.0
              : 0.1,
            entry.opacity
          ),
          lettersBy: [...entry.lettersBy, wordIndex],
        });
      }
    }
  });

  let blocks = [];
  for (const { letter, position, opacity } of letters.values()) {
    let positionKey = `${position[0]} ${position[1]} ${position[2]}`;

    let isOrbitCenter = true;
    for (let i = 0; i < 3; i++) {
      if (position[i] !== orbitCenter[i]) {
        isOrbitCenter = false;
      }
    }
    let onClick = (e: ThreeEvent<MouseEvent>) => {
      if (currentWordIndex === null) {
        e.stopPropagation();
        setOrbitCenter(position);
      }
    };

    blocks.push(
      <LetterBlock
        position={position}
        letter={letter}
        textColor={letter === "?" ? "red" : "black"}
        opacity={opacity}
        color={isOrbitCenter ? SELECTED_BLOCK_COLOR : BLOCK_COLOR}
        onClick={onClick}
        key={positionKey}
      />
    );
  }

  let solved = true;
  for (let i = 0; i < crossword.words.length; i++) {
    if (crossword.words[i].word != words[i]) {
      solved = false;
      break;
    }
  }

  return (
    <>
      <Canvas>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        {blocks}
        <OrbitControls target={orbitCenter} />
      </Canvas>
      {solved && (
        <div className="flex justify-center items-center absolute w-full h-full pointer-events-none text-5xl bg-white/75">
          <p>Crossword solved!</p>
        </div>
      )}
    </>
  );
}

interface CrosswordMenuProps {
  crossword: Crossword;
  words: string[];
  setWords: (words: string[]) => void;
  currentWordIndex: null | number;
  setCurrentWordIndex: (wordIndex: null | number) => void;
  orbitCenter: [number, number, number];
  setOrbitCenter: (orbitCenter: [number, number, number]) => void;
}

function CrosswordMenu({
  crossword,
  words,
  setWords,
  currentWordIndex,
  setCurrentWordIndex,
  orbitCenter,
  setOrbitCenter,
}: CrosswordMenuProps) {
  let letters = new Map();
  crossword.words.forEach(({ word, direction, start }) => {
    for (let i = 0; i < word.length; i++) {
      let position = wordLetterPosition(start, direction, i);
      let positionKey = `${position[0]} ${position[1]} ${position[2]}`;
      letters.set(positionKey, {
        letter: " ",
        lettersBy: [],
      });
    }
  });

  words.forEach((word, wordIndex) => {
    let { direction, start } = crossword.words[wordIndex];
    for (let i = 0; i < word.length; i++) {
      let position = wordLetterPosition(start, direction, i);
      let positionKey = `${position[0]} ${position[1]} ${position[2]}`;

      let entry = letters.get(positionKey);
      if (entry.letter === " ") {
        letters.set(positionKey, {
          letter: word[i],
          lettersBy: [...entry.lettersBy, wordIndex],
        });
      } else if (word[i] === " " || entry.letter === word[i]) {
        letters.set(positionKey, {
          letter: entry.letter,
          lettersBy: [...entry.lettersBy, wordIndex],
        });
      } else {
        letters.set(positionKey, {
          letter: "?",
          lettersBy: [...entry.lettersBy, wordIndex],
        });
      }
    }
  });

  let wordValidity: boolean[] = new Array(words.length).fill(true);
  for (const { letter, lettersBy } of letters.values()) {
    if (letter === "?") {
      lettersBy.forEach((i: number) => {
        wordValidity[i] = false;
      });
    }
  }
  for (let i = 0; i < words.length; i++) {
    if (words[i].length != crossword.words[i].word.length) {
      wordValidity[i] = false;
      continue;
    }

    for (let j = 0; j < words[i].length; j++) {
      if (words[i][j] === " ") {
        wordValidity[i] = false;
        break;
      }
    }
  }

  let solved = true;
  for (let i = 0; i < crossword.words.length; i++) {
    if (crossword.words[i].word != words[i]) {
      solved = false;
      break;
    }
  }

  let containsOrbitCenter = crossword.words.map((word) => {
    let endBlock = wordLetterPosition(
      word.start,
      word.direction,
      word.word.length - 1
    );
    for (let i = 0; i < 3; i++) {
      // Check that the orbit center coordinates lie between word.start and endBlock in every dimension.
      if (
        !(
          (word.start[i] <= orbitCenter[i] && orbitCenter[i] <= endBlock[i]) ||
          (word.start[i] >= orbitCenter[i] && orbitCenter[i] >= endBlock[i])
        )
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div>
      <p className="pb-2 border-b text-center">
        {solved ? "Crossword solved!" : "Not solved"}
      </p>
      <p className="mt-3 text-ellipsis overflow-hidden">
        Name: {crossword.name}
      </p>
      {currentWordIndex === null && (
        <div className="mt-3">
          <p className="my-1">Words:</p>
          {words.map((word, index) => (
            <div className="my-1" key={index}>
              <span
                onClick={() => {
                  setCurrentWordIndex(index);
                  let { start, direction, word } = crossword.words[index];
                  setOrbitCenter(
                    wordLetterPosition(
                      start,
                      direction,
                      Math.floor(word.length / 2)
                    )
                  );
                }}
                className={
                  "flex justify-between cursor-pointer " +
                  (wordValidity[index] ? "" : "text-red-700 ") +
                  (containsOrbitCenter[index] ? "p-1 rounded bg-sky-100" : "")
                }
              >
                <span className="text-ellipsis overflow-hidden">
                  {word.replaceAll(" ", "_") +
                    "_".repeat(
                      crossword.words[index].word.length - word.length
                    )}
                </span>
                <span>{"(" + crossword.words[index].word.length + ")"}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {currentWordIndex !== null && (
        <>
          <div className="my-3 flex items-center gap-1">
            <button
              onClick={() => {
                setCurrentWordIndex(null);
              }}
            >
              <span className="flex gap-1 items-center">
                <FaArrowLeft />
                <span>Back to words</span>
              </span>
            </button>
          </div>
          <div className="my-3">
            <p>Word:</p>
            <input
              value={words[currentWordIndex]}
              className="border border-slate-300 p-0.5"
              onChange={(e) => {
                let word = e.target.value.toUpperCase();
                if (
                  word.length <=
                    crossword.words[currentWordIndex as number].word.length &&
                  onlyContainsUpperCaseAlphabetsAndSpaces(word)
                ) {
                  setWords([
                    ...words.slice(0, currentWordIndex as number),
                    word,
                    ...words.slice((currentWordIndex as number) + 1),
                  ]);
                }
              }}
            />
          </div>
          <div className="my-3">
            <span>Description:</span>
            <p>{crossword.words[currentWordIndex].description}</p>
          </div>
        </>
      )}
    </div>
  );
}

function SolveCrossword() {
  let [crossword, setCrossword] = useState(null as null | Crossword);
  let [words, setWords] = useState([] as string[]);
  let [currentWordIndex, setCurrentWordIndex] = useState(null as null | number);
  let [orbitCenter, setOrbitCenter] = useState([0, 0, 0] as [
    number,
    number,
    number
  ]);

  useEffect(() => {
    document.title = "Solve crossword";
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="grow flex justify-between">
        <div className="border-r p-3 space-y-3 w-60">
          <div className="border-b pb-3 space-y-1">
            <p>Open crossword:</p>
            <OpenCrossword
              onOpen={(crossword) => {
                setCrossword(crossword);
                setWords(new Array(crossword.words.length).fill(""));
                setOrbitCenter([0, 0, 0]);
                setCurrentWordIndex(null);
              }}
            />
          </div>
          {crossword && (
            <CrosswordMenu
              crossword={crossword}
              words={words}
              setWords={setWords}
              currentWordIndex={currentWordIndex}
              setCurrentWordIndex={setCurrentWordIndex}
              orbitCenter={orbitCenter}
              setOrbitCenter={setOrbitCenter}
            />
          )}
        </div>
        <div className="grow flex justify-center items-center bg-gray-300">
          <div className="h-5/6 w-11/12 bg-white flex justify-center items-center relative">
            {crossword && (
              <ViewCrossword
                crossword={crossword}
                words={words}
                currentWordIndex={currentWordIndex}
                orbitCenter={orbitCenter}
                setOrbitCenter={setOrbitCenter}
              />
            )}
            {!crossword && (
              <p className="text-2xl p-5 text-center">
                Open a crossword to solve from the left menu, or try out this{" "}
                <span
                  className="underline cursor-pointer"
                  onClick={() => {
                    setCrossword(EXAMPLE_CROSSWORD);
                    setWords(
                      new Array(EXAMPLE_CROSSWORD.words.length).fill("")
                    );
                    setOrbitCenter([0, 0, 0]);
                    setCurrentWordIndex(null);
                  }}
                >
                  example
                </span>
                .
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<SolveCrossword />} />
        <Route path="/create" element={<CreateCrossword />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
