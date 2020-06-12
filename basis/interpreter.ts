


type State = Map<string, DictionaryEntry>;

type Token = string;
type Tokens = Token[];

interface Word {
  name: string,
  impl: any,
  immediate?: boolean,
}

type ImmediateCall = (lex: Cursor, c: Continuation) => {lexer: Cursor, continuation: Continuation}

interface ImmediateWord {
  name: string,
  impl: ImmediateCall,
  immediate: true,
}

type Words = Word[];


type DictionaryEntry = Word;

type NotFound = false
const NotFound : NotFound = false;

type DictionaryLookup = Word | NotFound;

interface Cursor {
  ndx: number;
  tokens: Tokens;
  curToken: () => string;
  nextToken: () => string;
  hasTokens: () => boolean;
}

function Lexer(line: string): Cursor {
  const tokens = line.split(/ +/).filter(function (t) {
    return t != "";
  });
  let ndx = 0;

  return {
    ndx: 0,
    tokens,
    curToken: () => tokens[ndx],
    nextToken: () => tokens[ndx++],
    hasTokens: () => ndx < tokens.length,
  };
}

function nsLookup(state: State, word: string): DictionaryLookup {
  const entry = state.get(word);
  return (typeof entry === "undefined" ? NotFound : entry);
}

const Numeric = (token: Token) : Word =>  {
  return {
    name: "Numeric",
    impl: () => parseFloat(token),
  }
}

const String = (token: Token) : Word => {
  return {
    name: "String",
    impl: () => token,
  }
}

interface ParseStep {
  continuation: Continuation,
  parser: Cursor,
}

function parseWord(word: Token, parser: Cursor, c: Continuation) : ParseStep {
  if (word.match(/^[+-]?\d+(\.\d+)?(e\d+)?$/)) {
    c.program.push(Numeric(word));
    return {parser, continuation: c};
  }
/*else if (nsLookup(state, word) && nsLookup(state, word).immediate) {
    state = nsLookup(state, word).call(null, parser, state, tokens);
  } */

  let w = nsLookup(c.state, word);

  if ((w as Word)) {
    c.program.push((w as Word));
  }
  else if ((w as ImmediateWord)) {
    //return (w as ImmediateWord).call(parser, program, state);
  }
  else {
      c.program.push(String(word)); // Unknown words? -> string
  }

  return { parser, continuation: c };
}

interface Continuation {
  state: State,
  program: Words
}

function parseLine(line: string, state: State) : Continuation {
  let parser = Lexer(line)
  let program : Words = [];
  let _continuation = {program, state};

  while (parser.hasTokens()) {
    let {continuation} = parseWord(parser.nextToken(), parser, _continuation)
    _continuation = continuation
  }

  return _continuation
}

export {
  Lexer,
  parseLine,
};

/*string[]
function evaluate(tokens: Tokens, state: Map) {
  tokens.map(function (tok) {
    if (typeof(tok) === "number" || typeof(tok) === "string") {
      state = state.change('stk', function (stk) { return stk.unshift(tok) })
    }
    else if (typeof(tok) === "function") {
      state = tok.call(null, state)
    }
  })
  return state
}



function nsLookup(state, word) {
  for (ns = state.get('ns'); ns != null; ns = ns.get('_parent')) {
    if (ns.get(word) !== null) {
      return ns.get(word);
    }
  }
}


function parseAndEval(line, state) {
  var parser = new Parser(line)
  var tokens = []

  while (parser.hasTokens()) {
    result = parseWord(parser.nextToken(), parser, tokens, state)
    state = result.state
  }

  return evaluate(tokens, state)
}

Immutable.Map.prototype.change = function (key, mutator) {
    return this.set(key, mutator(this.get(key)))
}

Immutable.Map.prototype.first = function (key) {
    return this.get('stk').get(0)
}

Immutable.Map.prototype.second = function (key) {
    return this.get('stk').get(1)
}

function initState() {
  var binary = function (op) { // ( a b -- c )
    return function (state) {
      return state.change('stk', function (stk) {
          stk = stk.skip(2).toVector()
          return stk.unshift(op(state.first(), state.second()))
      })
    }
  }
  var parseUntil = function (endTok, parser, state) {
    var tokens = []
    while (parser.hasTokens() && parser.curToken() !== endTok) {
      parseWord(parser.nextToken(), parser, tokens, state)
    } // TODO: check for end of input & err
    parser.nextToken()  // throw away the end token
    return tokens
  }
  var immediate = function(word) {
    word.immediate = true;
    return word;
  }

// SO REALLY these need to be f(state) -> (state')
  return Immutable.Map({
    "stk": Immutable.Vector(), // the datastack
    "ns": Immutable.Map({
      "+": binary(function (a,b) {return b+a}), // these belong at the bottom of the namestack
      "-": binary(function (a,b) {return b-a}),
      "*": binary(function (a,b) {return b*a}),
      "/": binary(function (a,b) {return b/a}),
      dup: function (state) {
        return state.change('stk', function (stk) { return stk.unshift(state.first()) })
      },
      swap: function (state) {
        return state.change('stk', function (stk) {
          return stk.skip(2).toVector().unshift(state.first()).unshift(state.second())
        })
      },
      drop: function (state) {
        return state.change('stk', function (stk) {
          return stk.skip(1).toVector();
        });
      },
      cells: Immutable.Map(),
      let: immediate(function (parser, state) { // TODO, these should modify namespace and return changed state
          var varName = parser.nextToken()

          return state.change('ns', function (ns) {
            var cell = varName + '_cell';

            ns = ns.set(cell, 0.0);
            ns = ns.change('cells', function (cells) {
              return cells.set(varName, cell);
            });
            ns = ns.set(varName, function (state) {
              return state.change('stk', function (stk) {
                return stk.unshift(nsLookup(state, cell))
              })
            })
            return ns.set('>' + varName, function (state) {
                var first = state.first()
                state = state.change('ns', function (ns) {
                  return ns.set(cell, first)
                })
                return state.change('stk', function (stk) {
                  return stk.skip(1).toVector()
                });
            })
          })
      }),
      ":": immediate(function (parser, state) {
        var name = parser.nextToken()
        var tokens = tokens = parseUntil(';', parser, state)
        return state.change('ns', function (ns) {
          return ns.set(name, function (stk) {
            return evaluate(tokens, stk)
          })
        });
      }),
      loop: immediate(function (parser, state, tokens) {
        var loopBody = parseUntil('end', parser, state)

        tokens.push(function (state) {
            var end = state.first(), ndx = state.second()

            state = state.change('stk', function (stk) {  // Consume vars from stack
              stk = stk.skip(2).toVector()
              return stk;
            });
            while (ndx < end) {
              state = state.set('i', function () { return ndx });
              state = evaluate(loopBody, state)
              ndx++
            }
            return state
        })
        return state
      }),
       "IN:": immediate(function (parser, state) {
         return state.set('bufname', parser.nextToken())
       })
    })
  });
}

function calcLines(str) {
  var lines = (str === "" || !str ? [] : str.split('\n'))
  var total = 0
  var state = initState()

  var result = lines.map(function (line) {
    try {
      state = parseAndEval(line, state)
      var value = state.get('stk').toJS()
      state = state.set('stk', Immutable.Vector())

      if (value !== undefined && value.length == 1) {
        var ans = value[0]
        if (isNaN(ans)) {
          return ans.toString()
        }
        else if (typeof(ans) == "number") {
          total += ans
          return ans
        }
      }
      return (value && value.length == 0 ? '' : JSON.stringify(value))
    }
    catch (err) {
      console.log(err, "While evaluating '" + line + "'")
      return "#err"
    }
  })

  var ns = state.get('ns')
  state = state.toJS()
  return {
      result: result,
      total: total,
      cells: ns.get('cells').map(function (cell) {
              return ns.get(cell)
            }).toJS(),
      bufname: state.bufname
    }
}


// belongs in a 'budget' vocab
//       let$: function (parser, state) {
//         while (parser.hasTokens()) {
//           var name = state.immediate.let(parser, state) // TODO: fix, this is busted
//
//           var cls = function (varName) {
//             var goal = parser.nextToken()
//
//             var getter = state.cells.__lookupGetter__(varName)
//             state.cells.__defineGetter__(varName, function () { return {'val': getter(), 'goal': goal, 'toString': function () { return this.val + '/' + this.goal } } })
//           }
//           cls(name)
//         }
//    return state
//       },

*/
