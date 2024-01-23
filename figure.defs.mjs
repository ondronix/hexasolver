Array.prototype.asymmetric = function () {
  this.isAsymmetric = true;
  return this;
};

export default [
  // 0: ^ dark red
  [
    [0, 0],
    [-1, 1], [1, 1],
    [-2, 2], [2, 2]
  ],

  // 1: light blues bone (beware dups during rotation)
  [
    [0, 0],
    [-3, 1], [-1, 1], [1, 1],
    [-2, 2]
  ],

  // 2: red (asymmetric)
  [
    [0, 0],
    [-1, 1], [1, 1], [3, 1]
  ].asymmetric(),

  // 3: pink (asymmetric)
  [
    [0, 0], [2, 0], [6, 0],
    [3, 1], [5, 1]
  ].asymmetric(),

  // 4: aquamarine (almost bone) (asymmetric)
  [
    [0, 0], [2, 0],
    [1, 1],
    [1, 3], [2, 2]
  ].asymmetric(),

  // 5: wave-like (asymmetric) (beware dups during rotation)
  [
    [0, 0],
    [1, 1],
    [0, 2],
    [1, 3]
  ].asymmetric(),

  // 6: orange
  [
    [0, 0],
    [1, 1],
    [2, 2], [4, 2],
    [1, 3]
  ],

  // 7: yellow
  [
    [0, 0], [4, 0],
    [1, 1], [3, 1]
  ],

  // 8: blue (asymmetric)
  [
    [0, 0], [2, 0],
    [3, 1],
    [4, 2]
  ].asymmetric(),

  // 9: light-blue
  [
    [0, 0], [2, 0], [4, 0],
    [5, 1],
    [6, 2]
  ],

  // 10: green
  [
    [0, 0], [2, 0],
    [1, 1], [3, 1],
    [2, 2]
  ],

  // 11: purple (asymmetric)
  [
    [0, 0],
    [1, 1],
    [0, 2], [2, 2], [4, 2]
  ].asymmetric()
];