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

