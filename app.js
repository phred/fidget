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
    tokens: line.split(" "),
    curToken: function () { return this.tokens[this.ndx] },
    nextToken: function () { return this.tokens[this.ndx++] },
    hasTokens: function () { return this.ndx < this.tokens.length }
  }
}

function evaluate(tokens, stk) {
  tokens.map(function (tok) {
    if (typeof(tok) === "number") {
      stk = [tok].concat(stk)
    }
    else if (typeof(tok) === "function") {
      stk = tok.call(null, stk)
    }
  })
  return stk
}

function parseWord(word, parser, tokens, state) {
  if (word.match(/^[+-]?\d+(\.\d+)?(e\d+)?$/)) {
    tokens.push(parseFloat(word))
  }
  else if (state.immediate[word]) {
    state.immediate[word].call(null, parser, state)
  }
  else if (state[word]) {
    tokens.push(state[word])
  }
}
function parseAndEval(line, state) {
  var parser = new Parser(line)
  var tokens = []

  while (parser.hasTokens()) {
    parseWord(parser.nextToken(), parser, tokens, state)
  }

  return evaluate(tokens, [])
}

function initState() {
  var binary = function (op) {
    return function (stk) {
      return [op(stk[0], stk[1])].concat(stk.slice(2))
    }
  }
  return {
    "+": binary(function (a,b) {return a+b}),
    "-": binary(function (a,b) {return a-b}),
    "*": binary(function (a,b) {return a*b}),
    "/": binary(function (a,b) {return a/b}),
    "immediate": {
      "let": function (parser, state) {
        var varName = parser.nextToken()
        var cell = 0.0

        state[varName] = function (stk) { return [cell].concat(stk) }
        state['#' + varName] = function (stk) { cell += stk[0]; return stk }
        state.cells.__defineGetter__(varName, function () { return cell })
        return varName
      },
      "let$": function (parser, state) {
        while (parser.hasTokens()) {
          var name = state.immediate.let(parser, state)

          var cls = function (varName) {
            var goal = parser.nextToken()

            var getter = state.cells.__lookupGetter__(varName)
            state.cells.__defineGetter__(varName, function () { return {'val': getter(), 'goal': goal, 'toString': function () { return this.val + '/' + this.goal } } })
          }
          cls(name)
        }
      },
      ":": function (parser, state) {
        var name = parser.nextToken()
        var tokens = []

        while (parser.hasTokens() && parser.curToken() !== ';') {
          parseWord(parser.nextToken(), parser, tokens, state)
        }

        state[name] = function (stk) { return evaluate(tokens, stk) }
      },
      "loop": function (parser, state) {
        var tokens = []
        while (parser.hasTokens() && parser.curToken() !== 'end') {
          parseWord(parser.nextToken(), parser, tokens, state)
        }
        tokens.push(function (stk) {
          var ndx = stk[0], end = stk[1]
          while (ndx < end) {
            stk = evaluate(tokens, stk)	// TODO: close over loop var, make available as 'i', or hmm… put ndx on retain stack and make 'i' a general word?
            ndx++
          }
          return stk
        })
      }

    },
    cells: {}
  }
}
function calcLines(str) {
  var lines = (str == "" && [] || str.split('\n'))
  var total = 0
  var state = initState()

  var result = lines.map(function (line) {
    try {
      var result = parseAndEval(line, state)
      if (result.length == 1) {
        var ans = result[0]
        if (typeof(ans) == "number") {
          total += ans
          return ans;
        }
      }
      return "";// || "no";//JSON.stringify(result)
    }
    catch (err) {
      console.log(err.stack)
      return "#err"
    }
  })
  return {'result': result, 'total': total, 'cells': state.cells}
}
