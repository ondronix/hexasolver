import fs from 'node:fs';
import zlib from 'node:zlib';
import v8 from 'node:v8';
import readline from 'node:readline';
import { setInterval } from 'node:timers';
import {
  Worker, isMainThread, parentPort, workerData,
} from 'node:worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import * as $C from 'js-combinatorics';
import _ from 'lodash';
import figures from './figure.defs.mjs';
import { rotateVector, shuffle } from './utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const yScale = Math.sqrt(3);
const rotations = [0, 1, 2, 3, 4, 5];

BigInt.prototype['toJSON'] = function () {
  return this.toString();
};

const now = Date.now();

function rotateAndMoveFigure(figure, rotTimes, shift) {
  const rotatedFigure = [];
  for (const [x, y] of figure) {
    const newP = rotateVector([x, y * yScale], rotTimes, Math.PI / 3);
    rotatedFigure.push([Math.round(newP[0]) + shift[0], Math.round(newP[1] / yScale) + shift[1]]);
  }
  return rotatedFigure;
}

function mirrorFigure(figure) {
  return figure.map(([x, y]) => [-x, y]);
}

// 56 cells
const gameArea = [Array.from({ length: 9 }, (_, x) => [3 + 2 * x, 0, x]), // 9
  Array.from({ length: 10 }, (_, x) => [2 + 2 * x, 1, 9 + x]), // 10
  Array.from({ length: 10 }, (_, x) => [1 + 2 * x, 2, 19 + x]), // 10
  Array.from({ length: 10 }, (_, x) => [2 * x, 3, 29 + x]), // 10
  Array.from({ length: 9 }, (_, x) => [1 + 2 * x, 4, 39 + x]), // 9
  Array.from({ length: 8 }, (_, x) => [2 + 2 * x, 5, 48 + x]) // 8
];

const allGamePoses = gameArea.flat();

const allGamePosesHashes = allGamePoses.map(posToHash);

function posToHash([x, y]) {
  return `${x}:${y}`;
}

function posToGameIndex(pos) {
  return allGamePosesHashes.indexOf(posToHash(pos));
}

function figureToGameValue(figure) {
  return figure.map(posToGameIndex).reduce((acc, v) => acc + BigInt(2 ** v), 0n);
}

function valueToFigureHashes(value) {
  const hashes = [];
  for (let i = 0n; i < 56n; i++) {
    if (value & (2n ** i)) {
      hashes.push(allGamePosesHashes[i]);
    }
  }
  return hashes;
}

function isPosInBoundaries(pos) {
  return posToGameIndex(pos) > -1;
}

function renderFigureInArea(figureOrValue) {
  const figureHashes = figureOrValue instanceof Array ? new Set(figureOrValue.map(posToHash)) : new Set(valueToFigureHashes(figureOrValue));
  console.log('――――――――――――――――――――――――――――――――――――――――――――');
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 30; x++) {
      if (isPosInBoundaries([x, y])) {
        if (figureHashes.has(posToHash([x, y]))) {
          process.stdout.write('● ');
        } else {
          process.stdout.write('. ');
        }
      } else {
        process.stdout.write('  ');
      }
    }
    console.log();
  }
}

function renderStateInArea(state, outStream = process.stdout) {
  const map = state.reduce((a, fState) => {
    return valueToFigureHashes(fState.value)
      .reduce((a2, hash) => Object.assign(a2, { [hash]: fState.figure.toString('16') }), a);
  }, {});
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 30; x++) {
      if (isPosInBoundaries([x, y])) {
        const figure = map[posToHash([x, y])];
        if (figure) {
          outStream.write(`${figure} `);
        } else {
          outStream.write('. ');
        }
      } else {
        outStream.write('  ');
      }
    }
    outStream.write('\n');
  }
  outStream.write('\n');
}

const allFiguresValues = [];

figures.forEach((figureDefault, i) => {
  const figureValues = [];

  const figureMods = [figureDefault];
  if (figureDefault.isAsymmetric) figureMods.push(mirrorFigure(figureDefault));

  for (const figure of figureMods) {
    for (const basePos of allGamePoses) {
      for (const rot of rotations) {
        const movedFigure = rotateAndMoveFigure(figure, rot, basePos);
        if (movedFigure.every(isPosInBoundaries)) {
          figureValues.push(figureToGameValue(movedFigure));
          // if (i === 1) renderFigureInArea(movedFigure);
        }
      }
    }
  }
  allFiguresValues.push(_.uniq(figureValues));
});

// console.log('allFiguresValues', allFiguresValues.map(values => values.length));

const GOAL = 2n ** 56n - 1n;

const fmt = new Intl.NumberFormat('ru-RU');

const rowBitsForLevel_Diag = [
  [0n, 9n, 19n, 29n], // 6 517 states
  [1n, 10n, 20n, 30n, 39n], // 66 339
  [2n, 11n, 21n, 31n, 40n, 48n], // 460 352
  [3n, 12n, 22n, 32n, 41n, 49n],
  [4n, 13n, 23n, 33n, 42n, 50n],
  [5n, 14n, 24n, 34n, 43n, 51n],
  [6n, 15n, 25n, 35n, 44n, 52n],
  [7n, 16n, 26n, 36n, 45n, 53n],
  [8n, 17n, 27n, 37n, 46n, 54n],
  /**/[18n, 28n, 38n, 47n, 55n]
];

const rowBitsForLevel = rowBitsForLevel_Diag;

const figuresPowerSet = [...new $C.PowerSet([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])]
  .filter(a => a.length > 0);

function trySolve({ level = 0, state = [] } = {}, recursive = true) {
  const prevValuesSum = state.reduce((acc, fState) => acc + fState.value, 0n) || 0n;
  const prevFigures = state.map(fState => fState.figure);

  if (prevValuesSum === GOAL || !rowBitsForLevel[level]) {
    // renderStateInArea(state);
    if (prevValuesSum === GOAL) {
      fs.appendFileSync(`result${workerData?.workerIndex ?? ''}-${workerData?.mainStartTime || now}.txt`, `${JSON.stringify(state)}\n`);
    }
    return state;
  }

  let rowBits = rowBitsForLevel[level].reduce((a, v) => a + 2n ** v, 0n);
  if (prevValuesSum) {
    rowBits &= ~prevValuesSum;
  }

  if (!rowBits) {
    const nextState = { level: level + 1, state };
    return recursive ?
      setImmediate(() => {
        // go deeper
        trySolve(nextState);
      }) : [nextState];
  }

  const allValuesForRow = allFiguresValues
    .map((figureValues, i) => {
      if (prevFigures.includes(i)) return [state.find(fState => fState.figure === i).value];
      const filteredValues = figureValues.filter(v => (v & rowBits) && !(v & prevValuesSum));
      return filteredValues.length ? filteredValues : [0n];
    });

  const numOfEmptyCellsInRow = rowBitsForLevel[level].reduce((a, v) => a + ((rowBits & (2n ** v)) ? 1 : 0), 0);
  const figureIndexesVariants = figuresPowerSet
    .filter(v => v.length <= numOfEmptyCellsInRow);

  const nextStates = [];
  for (const indexes of figureIndexesVariants) {
    for (const p of $C.CartesianProduct.from(indexes.map(i => allValuesForRow[i]))) {
      if (p.some(v => v === 0n)) continue;
      const orUnion = p.reduce((acc, v) => acc | v);
      const sum = p.reduce((acc, v) => acc + v);
      const notIntersected = orUnion === sum && !(prevValuesSum & orUnion);
      if (notIntersected && ((orUnion | prevValuesSum) & rowBits) === rowBits) {
        const nextState = {
          level: level + 1,
          state: [
            ...state,
            ...indexes
              .map(figure => ({ level, figure, value: p[indexes.indexOf(figure)] }))
              .filter(fState => fState.value)
          ],
        };
        if (recursive) {
          setImmediate(() => {
            // go deeper
            trySolve(nextState);
          });
        } else {
          nextStates.push(nextState);
        }
      }
    }
  }
  return nextStates;
}

process
  .on('unhandledRejection', (e) => {
    console.error(e);
    process.exit(1);
  })
  .on('uncaughtException', (e) => {
    console.error(e);
    process.exit(1);
  });

if (isMainThread) {
  const NUM_OF_WORKERS = 2;

  const START_FROM_INDEX = 0;
  const START_LEVEL = 0;
  const STATES_FILE = `states-${START_LEVEL}.bin`;
  const NEXT_STATES_FILE = `states-${START_LEVEL + 1}.bin`;

  let rootStates = [];
  if (fs.existsSync(STATES_FILE)) {
    rootStates = v8.deserialize(fs.readFileSync(STATES_FILE));
  } else if (START_LEVEL === 0) {
    rootStates = trySolve({}, false);
    fs.writeFileSync(STATES_FILE, v8.serialize(rootStates));
  }

  let nextLevelStates = [];
  if (fs.existsSync(NEXT_STATES_FILE)) {
    nextLevelStates = v8.deserialize(fs.readFileSync(NEXT_STATES_FILE));
    console.log('nextLevelStates found:', fmt.format(nextLevelStates.length));
  }

  const ROOT_STATES_INITIAL_SIZE = rootStates.length;

  if (START_FROM_INDEX > 0) {
    rootStates = rootStates.slice(0, -START_FROM_INDEX);
  }

  console.log('START_LEVEL:', START_LEVEL);
  console.log('rootStates ready:', fmt.format(ROOT_STATES_INITIAL_SIZE), ', left:', fmt.format(rootStates.length));

  const workers = new Map();
  const handlers = {
    onMessage(states) {
      if (states?.length) {
        nextLevelStates.push(...states);
      }
      console.log('found/left:', `${fmt.format(nextLevelStates.length)} / ${fmt.format(rootStates.length)}`);
      this.postMessage(rootStates.pop());
    },
    onExit(code) {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
      }
      workers.delete(this);
      if (workers.size === 0) {
        console.log('All workers exited. Done!', fmt.format(nextLevelStates.length));
        fs.writeFileSync(NEXT_STATES_FILE, v8.serialize(nextLevelStates));
        process.exit();
      } else {
        console.log('active workers left: ', workers.size);
      }
    },
  };
  for (let i = 0; i < NUM_OF_WORKERS; i++) {
    const worker = new Worker(__filename, {
      workerData: { workerIndex: i, mainStartTime: now },
    });
    worker
      .on('message', handlers.onMessage.bind(worker))
      .on('exit', handlers.onExit.bind(worker));
    workers.set(worker, i);
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c' && rootStates.length > 0) {
      console.log('Completing last root states and exiting');
      console.log('Next time start from index: ', ROOT_STATES_INITIAL_SIZE - rootStates.length);
      rootStates.length = 0;
    }
  });

  [...workers.keys()].forEach(w => w.postMessage(rootStates.pop()));
} else {
  parentPort.on('message', (nextState) => {
    if (!nextState) {
      console.log(`Worker ${workerData.workerIndex} got nothing - exiting`);
      process.exit();
    }
    setImmediate(() => {
      const states = trySolve(nextState, false);
      parentPort.postMessage(states);
    });
  });
  setInterval(() => {
  }, 1 << 30);
}
