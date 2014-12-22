// how to handle compilation
// quotation -> write 'execution token', call to anonymous compiled function, could be inlined (function {})()
//
// inferring arity is going to be a bitch, factor does it by requiring
// side-effects for everything and using a type inference / type
// calculus system. Though with the simplicity of the type
// system... hmm... it's actually not bad to figure out.
//
// If the side effects are ( a b c -- d ) ( a -- c c ) then the side effect is:
// ( -3 -- +1 ) ( -1 -- +2 ) -> (-3 -- ) (+1 + -1) ( -- +2 ) -> ( -3 -- +2 )
//
// ( a b -- c ) ( d e -- f ) -> (should be ( a b c d -- e f )
// ( -2 -- +1 ) ( -2 -- +1 )
// ( -4 -- +2 )
//
// huh so could really treat them like complex numbers, 2-element
// vectors, 'cause that's how they add up. And the trick is making
// sure that the final product matches the declared product, plus
// adding tricks for those n* words (ndrop, ndup) which are
// compile-time macros, type-checked just like everything else.
//
//
// idk, compilation could be hard
//
// words should be able to be redefined in each vocab as in forth,
// words can be multiply defined and when compiled they reference the
// previous implementations. forth does this by an append-only
// dictionary whose header includes a ref to the previous
// definition. Forth also uses the dictionary for storage cells.
//
// Compiling then does a linear traverse of the dictionary linked list
// to find the previous definition and then either encodes a call to
// the previous word or inlines it (for inline words).
//
// OK, so what would the compiler look like?
//
// Just read through an intro to Scheme's implementation of
// continuations -- call-with-current-continuation. They said to
// visualize program execution as a tree of instructions and
// continuations as pointers to different points in the execution
// tree. When you do a call/cc it "reifies" the current execution
// point as a callable function passed as an argument to the first
// parameter of call/cc. Calling the reified continuation (sometimes
// called "reflecting" the continuation) returns execution to the
// caller of call/cc.
//
// Factor says that a continuation is T{ data call retain name catch }
// The way I'm interpreting now uses JS's stack as the callstack, for
// better or worse. I have a data stack, no retain stack, one global
// namespace (the thing called 'state' below), no catch stack (JS
// exceptions blow the stack and interpretation). Probably don't need
// all of those pieces to make this a compile-to-JS
// language. Callstack will have to be re-ifiable to properly
// implement continuations, though. Yeah, and then at that point it
// *can't* run as pure JS -- no continuations in the language, so it
// has to be faked by implementation.
//
// Factor's compilation-units & vocabulary namespace are rather
// elegant, it actually can tell when the word asked for is ambiguous.
//
// I wonder how forth handles its multiple pages of definitions? Does
// it replace the previous definitions in-place when you compile?
// Nope, it appears to always append definitions. They must be
// FORGET'd to be removed from the dictionary. I think that results in
// memory holes, since it'd be expensive to rebuild the list. The fact
// that existing words that rely on the old behaviour continue to
// work is actually quite nice.
//
// In a way the memory fragmentation doesn't matter, bootstrapping the
// program is done by loading code block by block. Just need to make
// sure that block loading is done in order of definitions, and it
// probably can't include circular definitions (though I don't know
// why you'd them. Recursion works fine)
//
// Append-only definitions make sense, and with the GC in Javascript
// memory fragmentation shouldn't be an issue. Well, also, it's going
// to be running at N levels of abstraction in a browser's script
// engine on a modern CPU, so worrying about memory fragmentation is a
// silly detail. Although using a fixed-sized memory segment
// (i.e. array) would be very interesting. Forth grows stack
// downwards, yes? I guess it doesn't matter, it's an implementation detail.
//
// word definition -> takes implied execution state (stack, namespaces, retain?) and returns modified execution state
//                 -> should be able to be generated & eval'd
//
// word properties are probably a good idea
//

function map(func) {
  var result = []
  for (var ndx in this) {
    result.push(func(this[ndx], ndx))
  }
  return result
}

function Parser(line) {
  return {
    ndx: 0,
    tokens: line.split(/ +/).filter(function (t) { return t != ""; }),
    curToken: function () { return this.tokens[this.ndx] },
    nextToken: function () { return this.tokens[this.ndx++] },
    hasTokens: function () { return this.ndx < this.tokens.length }
  }
}

function evaluate(tokens, state) {
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

function parseWord(word, parser, tokens, state) {
  if (word.match(/^[+-]?\d+(\.\d+)?(e\d+)?$/)) {
    tokens.push(parseFloat(word))
  }
  else if (nsLookup(state, word) && nsLookup(state, word).immediate) {
      state = nsLookup(state, word).call(null, parser, state, tokens)
  }
  else if (nsLookup(state, word)) {
    tokens.push(nsLookup(state, word))
  }
  else {
    tokens.push(word) // Unknown words? -> string
  }
  return {parser: parser, tokens: tokens, state: state}
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
    return function (s) {
      return s.change('stk', function (stk) {
          stk = stk.skip(2).toVector()
          return stk.unshift(op(s.first(), s.second()))
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
            return ns.set('#' + varName, function (state) {
                var first = state.first()
                state = state.change('ns', function (ns) {
                  return ns.set(cell, nsLookup(state, cell) + first)
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
  var lines = (str == "" && [] || str.split('\n'))
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
