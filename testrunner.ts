const watcher = Deno.watchFs(".");
for await (const event of watcher) {
   console.log(">>>> event", event);
   event.paths.forEach((path) => {
      const p = Deno.run({
         cmd: ['deno', 'test', path],
      });
   });
   // { kind: "create", paths: [ "/foo.txt" ] }
}

