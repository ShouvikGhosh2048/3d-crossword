import { OrbitControls } from "@react-three/drei";
import { Text, TransformControls } from "@react-three/drei/core";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { memo, useCallback, useRef, useState } from "react";
import { FaArrowLeft, FaTrash } from "react-icons/fa";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import { z } from "zod";

// https://stackoverflow.com/a/37193954
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#using_the_download_attribute_to_save_a_canvas_as_a_png
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#examples
// https://stackoverflow.com/a/66590179

function onlyContainsAlphabetsAndSpaces(s: string) {
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
  let positionsAndRotations: [
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
      {positionsAndRotations.map(([position, rotation], index) => (
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

type Crossword = {
  name: string;
  words: {
    word: string;
    direction: "X" | "Y" | "Z";
    start: [number, number, number];
    description: string;
  }[];
};

const crosswordSchema = z.object({
  name: z.string().min(1),
  words: z
    .object({
      word: z.string().min(1).max(10),
      direction: z.enum(["X", "Y", "Z"]),
      start: z.number().min(-10).max(10).array().length(3),
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

interface IntegerInputProps {
  min: number;
  max: number;
  value: number;
  onValueChange: (value: number) => void;
}

function IntegerInput({ min, max, value, onValueChange }: IntegerInputProps) {
  // We need a seperate inputValue as we want to allow '' and '-' in the input while typing.
  let [inputValue, setInputValue] = useState(value.toString());
  if (value !== Number(inputValue)) {
    setInputValue(value.toString());
  }

  return (
    <input
      className="w-9 border"
      type="number"
      value={inputValue}
      onChange={(e) => {
        let number = Number(e.target.value);
        if (Math.floor(number) === number && number >= min && number <= max) {
          setInputValue(e.target.value);
          onValueChange(number);
        }
      }}
      min={min}
      max={max}
      step="1"
    />
  );
}

interface WordPositionControlsProps {
  orbitCenter: [number, number, number];
  setWordCenter: (position: [number, number, number]) => void;
  setOrbitCenter: (position: [number, number, number]) => void;
}

// When TransformControls is rerendered, the current dragging is stopped.
// To prevent this we use memo.
const WordPositionControls = memo(function ({
  orbitCenter,
  setWordCenter,
  setOrbitCenter,
}: WordPositionControlsProps) {
  let transformControlsRef = useRef(null);
  return (
    <TransformControls
      position={orbitCenter}
      translationSnap={1}
      ref={transformControlsRef}
      onObjectChange={() => {
        let transformControls = transformControlsRef.current as any;
        setWordCenter([
          transformControls.worldPosition.x,
          transformControls.worldPosition.y,
          transformControls.worldPosition.z,
        ]);
      }}
      onMouseUp={() => {
        let transformControls = transformControlsRef.current as any;
        let newPosition = [
          transformControls.worldPosition.x,
          transformControls.worldPosition.y,
          transformControls.worldPosition.z,
        ] as [number, number, number];
        setWordCenter(newPosition);
        setOrbitCenter(newPosition);
      }}
    >
      <mesh></mesh>
    </TransformControls>
  );
});

function EditCrossword() {
  let [name, setName] = useState("");
  let [words, setWords] = useState(
    [] as {
      word: string;
      direction: "X" | "Y" | "Z";
      start: [number, number, number];
      description: string;
    }[]
  );
  let [currentWordIndex, setCurrentWordIndex] = useState(null as null | number);
  let [orbitCenter, setOrbitCenter] = useState([0, 0, 0] as [
    number,
    number,
    number
  ]);
  let [newCrossword, setNewCrossword] = useState(true);
  let setWordCenter = useCallback(
    (position: [number, number, number]) => {
      setWords((words) => [
        ...words.slice(0, currentWordIndex as number),
        {
          ...words[currentWordIndex as number],
          start: wordLetterPosition(
            position,
            words[currentWordIndex as number].direction,
            -Math.floor(words[currentWordIndex as number].word.length / 2)
          ),
        },
        ...words.slice((currentWordIndex as number) + 1),
      ]);
    },
    [currentWordIndex]
  );

  let letters = new Map();
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
        setOrbitCenter(position);
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
            ? "rgb(150, 150, 230)"
            : "rgb(200, 200, 200)"
        }
        onClick={onClick}
      />
    );
  }

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
    <div className="flex justify-between h-screen">
      <div className="border-r p-3 w-min space-y-3">
        <div className="border-b pb-3">
          <Link to="/" className="underline">
            Play crosswords
          </Link>
        </div>
        <div className="border-b pb-3">
          {newCrossword && (
            <button
              onClick={() => {
                setNewCrossword(false);
              }}
              className="underline"
            >
              Edit crossword
            </button>
          )}
          {!newCrossword && (
            <>
              <button
                onClick={() => {
                  setNewCrossword(true);
                  setWords([]);
                  setName("");
                  setOrbitCenter([0, 0, 0]);
                  setCurrentWordIndex(null);
                }}
                className="underline mb-3"
              >
                New crossword
              </button>
              <p className="mb-1">Open file to edit: </p>
              <OpenCrossword
                onOpen={({ name, words }) => {
                  setWords(words);
                  setName(name);
                  setOrbitCenter([0, 0, 0]);
                  setCurrentWordIndex(null);
                }}
              />
            </>
          )}
        </div>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          placeholder="Name"
          className="border mb-3 p-0.5"
        />
        {currentWordIndex === null && (
          <>
            <div className="flex justify-between mb-3">
              <span>Words:</span>
              <button
                onClick={() => {
                  setWords([
                    ...words,
                    {
                      word: "",
                      direction: "X",
                      start: orbitCenter,
                      description: "",
                    },
                  ]);
                  setCurrentWordIndex(words.length);
                }}
              >
                + New word
              </button>
            </div>
            <div className="space-y-1">
              {words.map((word, index) => (
                <div className="flex justify-between" key={index}>
                  <button
                    className={wordValidity[index] ? "" : "text-red-700"}
                    onClick={() => {
                      setCurrentWordIndex(index);
                      let { start, direction, word } = words[index];
                      let blockIndex = Math.floor(word.length / 2);
                      setOrbitCenter(
                        wordLetterPosition(start, direction, blockIndex)
                      );
                    }}
                  >
                    {word.word.length > 0
                      ? word.word.replaceAll(" ", "_")
                      : "_"}
                  </button>
                  <button
                    onClick={() => {
                      let orbitCenterStillExists = false;
                      for (let i = 0; i < words.length; i++) {
                        if (i === index) {
                          continue;
                        }

                        let { start, direction, word } = words[i];
                        let endBlock = wordLetterPosition(
                          start,
                          direction,
                          word.length - 1
                        );

                        orbitCenterStillExists = true;
                        for (let i = 0; i < 3; i++) {
                          if (
                            !(
                              (start[i] <= orbitCenter[i] &&
                                orbitCenter[i] <= endBlock[i]) ||
                              (start[i] >= orbitCenter[i] &&
                                orbitCenter[i] >= endBlock[i])
                            )
                          ) {
                            orbitCenterStillExists = false;
                          }
                        }

                        if (orbitCenterStillExists) {
                          break;
                        }
                      }

                      if (!orbitCenterStillExists) {
                        setOrbitCenter([0, 0, 0]);
                      }
                      setWords([
                        ...words.slice(0, index),
                        ...words.slice(index + 1),
                      ]);
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
              <FaArrowLeft
                onClick={() => {
                  setCurrentWordIndex(null);
                }}
              />
              <button
                onClick={() => {
                  setCurrentWordIndex(null);
                }}
              >
                Back
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
                      onChange={(e) => {
                        if (e.target.checked) {
                          let word = words[currentWordIndex as number];
                          setOrbitCenter(
                            wordLetterPosition(
                              word.start,
                              direction as "X" | "Y" | "Z",
                              Math.floor(word.word.length / 2)
                            )
                          );
                          setWords([
                            ...words.slice(0, currentWordIndex as number),
                            {
                              ...word,
                              direction: direction as "X" | "Y" | "Z",
                            },
                            ...words.slice((currentWordIndex as number) + 1),
                          ]);
                        }
                      }}
                      checked={
                        direction ===
                        words[currentWordIndex as number].direction
                      }
                    />
                    <label htmlFor={direction}>{direction}</label>
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
                      min={-10}
                      max={10}
                      value={words[currentWordIndex as number].start[i]}
                      onValueChange={(value) => {
                        let currentWord = words[currentWordIndex as number];
                        let newStart = [
                          ...currentWord.start.slice(0, i),
                          value,
                          ...currentWord.start.slice(i + 1),
                        ] as [number, number, number];
                        let { direction, word } = currentWord;
                        setOrbitCenter(
                          wordLetterPosition(
                            newStart,
                            direction,
                            Math.floor(word.length / 2)
                          )
                        );
                        setWords([
                          ...words.slice(0, currentWordIndex as number),
                          {
                            ...currentWord,
                            start: newStart,
                          },
                          ...words.slice((currentWordIndex as number) + 1),
                        ]);
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
                className="border"
                onChange={(e) => {
                  let word = e.target.value.toUpperCase();
                  if (
                    word.length <= 10 &&
                    onlyContainsAlphabetsAndSpaces(word)
                  ) {
                    setWords([
                      ...words.slice(0, currentWordIndex as number),
                      {
                        ...words[currentWordIndex as number],
                        word,
                      },
                      ...words.slice((currentWordIndex as number) + 1),
                    ]);
                    let { start, direction } =
                      words[currentWordIndex as number];
                    setOrbitCenter(
                      wordLetterPosition(
                        start,
                        direction,
                        Math.floor(word.length / 2)
                      )
                    );
                  }
                }}
              />
            </div>
            <div>
              <p>Description:</p>
              <textarea
                value={words[currentWordIndex as number].description}
                onChange={(e) => {
                  setWords([
                    ...words.slice(0, currentWordIndex as number),
                    {
                      ...words[currentWordIndex as number],
                      description: e.target.value,
                    },
                    ...words.slice((currentWordIndex as number) + 1),
                  ]);
                }}
                className="border"
              ></textarea>
            </div>
          </>
        )}
      </div>
      <div className="grow flex justify-center items-center bg-gray-100">
        <div className="h-5/6 w-11/12 bg-white">
          <Canvas>
            <ambientLight />
            <pointLight position={[10, 10, 10]} />
            {blocks}
            {currentWordIndex !== null &&
              words[currentWordIndex].word.length > 0 && (
                <WordPositionControls
                  orbitCenter={orbitCenter}
                  setWordCenter={setWordCenter}
                  setOrbitCenter={setOrbitCenter}
                />
              )}
            <OrbitControls target={orbitCenter} makeDefault />
          </Canvas>
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
        color={isOrbitCenter ? "rgb(150, 150, 230)" : "rgb(200, 200, 200)"}
        onClick={onClick}
        key={positionKey}
      />
    );
  }

  return (
    <Canvas>
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
      {blocks}
      <OrbitControls target={orbitCenter} />
    </Canvas>
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
      {solved ? (
        <p className="font-bold my-1">Crossword solved</p>
      ) : (
        <p className="font-bold my-1">Not solved</p>
      )}
      {currentWordIndex === null && (
        <div>
          <p className="my-1">Words:</p>
          {words.map((word, index) => (
            <div className="my-1" key={index}>
              <button
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
                  (wordValidity[index] ? "" : "text-red-700 ") +
                  (containsOrbitCenter[index] ? "p-1 rounded bg-sky-100" : "")
                }
              >
                {word.replaceAll(" ", "_") +
                  "_".repeat(crossword.words[index].word.length - word.length) +
                  " (" +
                  crossword.words[index].word.length +
                  ")"}
              </button>
            </div>
          ))}
        </div>
      )}
      {currentWordIndex !== null && (
        <>
          <div className="my-1 flex items-center gap-1">
            <FaArrowLeft
              onClick={() => {
                setCurrentWordIndex(null);
              }}
            />
            <button
              onClick={() => {
                setCurrentWordIndex(null);
              }}
            >
              Back
            </button>
          </div>
          <div className="my-3">
            <p>Word:</p>
            <input
              value={words[currentWordIndex]}
              className="border"
              onChange={(e) => {
                let word = e.target.value.toUpperCase();
                if (
                  word.length <=
                    crossword.words[currentWordIndex as number].word.length &&
                  onlyContainsAlphabetsAndSpaces(word)
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

function PlayCrossword() {
  let [crossword, setCrossword] = useState(null as null | Crossword);
  let [words, setWords] = useState([] as string[]);
  let [currentWordIndex, setCurrentWordIndex] = useState(null as null | number);
  let [orbitCenter, setOrbitCenter] = useState([0, 0, 0] as [
    number,
    number,
    number
  ]);

  return (
    <div className="h-screen flex justify-between">
      <div className="border-r w-min p-3 space-y-3">
        <div className="border-b pb-3">
          <Link to="/edit" className="underline">
            Edit crosswords
          </Link>
        </div>
        <div className="border-b pb-3">
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
      <div className="grow flex justify-center items-center bg-gray-100">
        <div className="h-5/6 w-11/12 bg-white">
          {crossword && (
            <ViewCrossword
              crossword={crossword}
              words={words}
              currentWordIndex={currentWordIndex}
              orbitCenter={orbitCenter}
              setOrbitCenter={setOrbitCenter}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<PlayCrossword />} />
        <Route path="/edit" element={<EditCrossword />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
